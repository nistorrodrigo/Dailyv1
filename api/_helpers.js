// Shared utilities for the Vercel serverless functions in /api.
//
// Note: this file is named with a leading underscore so Vercel doesn't
// expose it as its own /api/_helpers route. (Vercel uses the file path
// to derive routes, but underscore-prefixed files are treated as
// support modules.)

// Top-level imports for the SSRF guard further down. Vercel's Node
// runtime supports the `node:` prefix for Node core modules.
import dns from "node:dns";
import net from "node:net";

/**
 * Apply CORS headers to a serverless response. Replaces the previous
 * `Access-Control-Allow-Origin: *` blanket pattern that let any site on
 * the internet hit our endpoints. Now we honour an explicit allowlist
 * from the CORS_ALLOWED_ORIGINS env var, plus same-origin (which
 * doesn't need the header at all).
 *
 * Empty allowlist (the default for new deployments) means: only the
 * deployment's own domain can call the API from a browser, which is
 * what you want for an internal tool.
 */
export function applyCors(req, res) {
  const allowList = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers?.origin;
  if (origin && allowList.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

/**
 * fetch wrapper with retry-and-backoff for the upstream APIs we call
 * (SendGrid, BCRA, Alpha Vantage, etc.). Retries on:
 *   - thrown network errors (DNS hiccup, TLS timeout, etc.)
 *   - 5xx responses (server fault, often transient)
 *   - 429 (rate-limited; respect Retry-After if present)
 *
 * Does NOT retry 4xx responses other than 429 — those are caller bugs
 * that retrying won't fix and the caller should see immediately.
 *
 * Backoff is exponential (250ms, 500ms, 1000ms, 2000ms…) capped at 8s.
 */
export async function fetchWithRetry(url, init = {}, opts = {}) {
  const maxAttempts = opts.maxAttempts ?? 4;
  const baseMs = opts.baseMs ?? 250;
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const resp = await fetch(url, init);
      // 5xx and 429 are retryable. Everything else (including 4xx) returns.
      if (!resp.ok && (resp.status >= 500 || resp.status === 429) && attempt < maxAttempts - 1) {
        const retryAfterHeader = resp.headers.get("retry-after");
        const retryAfterMs = retryAfterHeader && /^\d+$/.test(retryAfterHeader.trim())
          ? parseInt(retryAfterHeader.trim(), 10) * 1000
          : null;
        const wait = retryAfterMs ?? Math.min(8000, baseMs * Math.pow(2, attempt));
        await sleep(wait);
        continue;
      }
      return resp;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts - 1) {
        await sleep(Math.min(8000, baseMs * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
  }
  // Shouldn't reach here, but typescript-ish safety:
  if (lastError) throw lastError;
  throw new Error("fetchWithRetry: unexpected exit");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Validate a Supabase JWT from the Authorization header. Returns
 * `{ ok: true, user }` if the token is valid AND the user's email
 * domain is in the configured allowlist (defaults to the LS domain);
 * `{ ok: false, reason }` otherwise.
 *
 * Use from any endpoint that returns analyst-private data or burns
 * paid third-party APIs. The pattern:
 *
 *   const auth = await requireAuth(req);
 *   if (!auth.ok) return res.status(401).json({ error: "Auth required" });
 *
 * `reason` is intentionally short and server-side-only — never echo
 * it to the client. The client should always see a generic 401.
 *
 * Lazily creates the Supabase client on first call so endpoints that
 * never use auth (the rare public ones) don't pay the import cost.
 */
let _supabaseAuth;
const ALLOWED_EMAIL_DOMAIN = "latinsecurities.ar";

export async function requireAuth(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (!auth || typeof auth !== "string") return { ok: false, reason: "no-header" };
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return { ok: false, reason: "malformed" };
  const token = m[1].trim();
  if (!token) return { ok: false, reason: "empty-token" };

  if (!_supabaseAuth) {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return { ok: false, reason: "supabase-not-configured" };
    _supabaseAuth = createClient(url, key);
  }

  try {
    const { data, error } = await _supabaseAuth.auth.getUser(token);
    if (error || !data?.user) return { ok: false, reason: error?.message || "invalid" };
    const email = data.user.email || "";
    if (!email.toLowerCase().endsWith("@" + ALLOWED_EMAIL_DOMAIN)) {
      return { ok: false, reason: `wrong-domain:${email}` };
    }
    return { ok: true, user: data.user };
  } catch (err) {
    return { ok: false, reason: `getUser-throw:${err?.message || err}` };
  }
}

// ─────────────────────────────────────────────────────────────────
// Link metadata extraction — used by the "auto-fill from URL" button
// on report-link inputs in the editor. Lives here (in a non-route
// helper module) rather than as its own /api/link-meta.js because
// Vercel's Hobby plan caps deployments at 12 serverless functions
// and we'd already hit it. Surfaced as a `mode: "link-meta"` branch
// inside /api/ai-draft.js — same auth gate, same POST contract.
// ─────────────────────────────────────────────────────────────────

/**
 * SSRF guard for `extractLinkMeta` and any future server-side URL
 * fetcher. The audit surfaced bypasses in the previous lexical-
 * prefix check:
 *
 *   - `http://2130706433/` (decimal IP for 127.0.0.1)
 *   - `http://0x7f000001/` (hex IP)
 *   - `http://[::ffff:127.0.0.1]/` (IPv6-mapped IPv4)
 *   - `http://metadata.aws.attacker.com/` (DNS-resolved to 169.254.x)
 *   - 302 redirect from a public IP to a private IP — old code did
 *     `redirect: "follow"` and never re-validated the target.
 *
 * Fix: resolve the hostname's actual IP via dns.lookup before fetch,
 * check IP families correctly (IPv4 *and* IPv6 private ranges),
 * disable automatic redirect following and re-validate each Location
 * through the same guard. (`dns` and `net` imported at the top of
 * the file.)
 */

/** Quick lexical safety net — keeps obvious literals out of the
 *  resolver entirely. The DNS step below is the authoritative check
 *  but a literal `localhost` shouldn't even be sent for resolution. */
const BLOCKED_LITERAL_HOSTNAMES = new Set(["localhost", "0.0.0.0", "broadcasthost"]);

/** True if an IP literal lands in a range we never want to talk to.
 *  Treats IPv4-mapped IPv6 (`::ffff:127.0.0.1`) as IPv4 for the
 *  check. Treats all IPv6 ULA / link-local / loopback as blocked. */
function isPrivateIp(ip) {
  if (!ip) return true;
  const v = net.isIP(ip);
  if (v === 0) return true; // not an IP at all — fail closed

  // Normalise IPv4-mapped IPv6 (e.g. `::ffff:127.0.0.1`) to the
  // underlying IPv4 string for the private-range check.
  let ipv4 = null;
  if (v === 4) {
    ipv4 = ip;
  } else if (v === 6) {
    // ::1 loopback, fc00::/7 ULA, fe80::/10 link-local — block.
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (/^fc/.test(lower) || /^fd/.test(lower)) return true; // fc00::/7
    if (/^fe[89ab]/.test(lower)) return true;                // fe80::/10
    // IPv4-mapped IPv6 — block the entire ::ffff:0:0/96 range
    // outright (no legitimate reason to fetch a tunnel-encoded
    // IPv4 address). Covers both the dotted form
    // `::ffff:127.0.0.1` and the canonical normalised form
    // `::ffff:7f00:1` that Node's URL parser emits.
    if (/^::ffff:/.test(lower)) return true;
  }

  if (ipv4) {
    const [a, b] = ipv4.split(".").map((x) => parseInt(x, 10));
    if (a === 0) return true;                                   // 0.0.0.0/8
    if (a === 10) return true;                                  // 10.0.0.0/8
    if (a === 127) return true;                                 // 127.0.0.0/8
    if (a === 169 && b === 254) return true;                    // 169.254.0.0/16 (link-local + AWS/GCP metadata)
    if (a === 172 && b >= 16 && b <= 31) return true;           // 172.16.0.0/12
    if (a === 192 && b === 168) return true;                    // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true;          // 100.64.0.0/10 (CGNAT)
    if (a >= 224) return true;                                  // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
  }
  return false;
}

/** Async DNS-resolve the hostname and reject if any returned IP is
 *  in a private range. Returns the first public IP on success.
 *
 *  Note: we don't fully mitigate DNS rebinding (the attacker could
 *  TTL-flip between this lookup and the actual fetch's resolve).
 *  Real-world mitigation would involve fetching by IP with a `Host:`
 *  header — left for a future hardening pass; this fix closes the
 *  far-more-common single-resolve attack vector.
 */
async function resolveAndValidateHost(hostname) {
  // `new URL("http://[::1]/").hostname` returns `[::1]` (with
  // brackets) in Node. Strip brackets before any net.isIP check —
  // otherwise `net.isIP("[::1]")` returns 0 ("not an IP") and we'd
  // fall through to DNS, which then fails for the malformed name.
  const bareHost = hostname.replace(/^\[/, "").replace(/\]$/, "");
  // Literal hostnames we never want to resolve.
  if (BLOCKED_LITERAL_HOSTNAMES.has(bareHost.toLowerCase())) {
    return { ok: false, error: "Hostname not allowed" };
  }
  // If it's already an IP literal, validate directly without DNS.
  if (net.isIP(bareHost)) {
    if (isPrivateIp(bareHost)) {
      return { ok: false, error: "IP literal in private range not allowed" };
    }
    return { ok: true, ip: bareHost };
  }
  // Resolve and check every returned address.
  try {
    const records = await new Promise((resolve, reject) => {
      dns.lookup(bareHost, { all: true, family: 0 }, (err, addrs) => {
        if (err) reject(err); else resolve(addrs);
      });
    });
    if (!records.length) return { ok: false, error: "Hostname did not resolve" };
    for (const r of records) {
      if (isPrivateIp(r.address)) {
        return { ok: false, error: "Hostname resolves into a private range" };
      }
    }
    return { ok: true, ip: records[0].address };
  } catch (err) {
    return { ok: false, error: `DNS lookup failed: ${err?.message || "unknown"}` };
  }
}

async function validateUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, error: "Only http and https URLs are supported" };
  }
  const dnsCheck = await resolveAndValidateHost(u.hostname);
  if (!dnsCheck.ok) return { ok: false, error: dnsCheck.error };
  return { ok: true, url: u };
}

// Stream-and-cap reader. Aborts the body once we've collected the
// configured byte ceiling so a malicious server can't pipe gigabytes
// of HTML at us. 256 KB is enough for any real <head> + a generous
// chunk of <body>, which is plenty for OG/title parsing.
const META_MAX_BYTES = 256 * 1024;
async function readCapped(resp) {
  const reader = resp.body?.getReader?.();
  if (!reader) {
    // Fallback for runtimes without streaming Response.body — read
    // everything up front and slice. Same cap.
    const text = await resp.text();
    return text.slice(0, META_MAX_BYTES);
  }
  const decoder = new TextDecoder("utf-8");
  let total = 0;
  let buf = "";
  while (total < META_MAX_BYTES) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    buf += decoder.decode(value, { stream: true });
    if (total >= META_MAX_BYTES) break;
  }
  try {
    await reader.cancel();
  } catch {
    // best-effort cleanup
  }
  return buf;
}

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

function pickMeta(html, names) {
  // Try `<meta name|property="..." content="...">` in either attribute
  // order. names is checked in priority order — first match wins.
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const patterns = [
      new RegExp(`<meta[^>]+(?:name|property)\\s*=\\s*["']${escaped}["'][^>]+content\\s*=\\s*["']([^"']*)["']`, "i"),
      new RegExp(`<meta[^>]+content\\s*=\\s*["']([^"']*)["'][^>]+(?:name|property)\\s*=\\s*["']${escaped}["']`, "i"),
    ];
    for (const re of patterns) {
      const m = re.exec(html);
      if (m && m[1]) return decodeEntities(m[1]).trim();
    }
  }
  return undefined;
}

function parseMetaFromHtml(html) {
  // Title: prefer og:title (publishers usually set this richer than
  // the raw <title> for sharing previews), then twitter:title, then
  // the document <title>.
  const ogTitle = pickMeta(html, ["og:title", "twitter:title"]);
  let title = ogTitle;
  if (!title) {
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (m && m[1]) title = decodeEntities(m[1].replace(/\s+/g, " ")).trim();
  }
  const author = pickMeta(html, ["author", "article:author", "twitter:creator", "dc.creator"]);
  const description = pickMeta(html, ["og:description", "twitter:description", "description"]);
  const siteName = pickMeta(html, ["og:site_name", "application-name"]);
  return {
    title: title || undefined,
    author: author || undefined,
    description: description || undefined,
    siteName: siteName || undefined,
  };
}

/**
 * Fetch a URL server-side and extract title / author / description /
 * site name from the HTML head. Returns either:
 *   { ok: true, status: 200, ...meta }
 *   { ok: false, status: 4xx | 5xx, error: "..." }
 *
 * Caller is responsible for the auth gate — this function just does
 * the fetch + parse work, with the SSRF / size / timeout guards
 * baked in.
 */
export async function extractLinkMeta(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return { ok: false, status: 400, error: "Missing url" };
  }
  let current = await validateUrl(rawUrl.trim());
  if (!current.ok) return { ok: false, status: 400, error: current.error };

  // 6s wall-clock ceiling across the whole redirect chain.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    // Manual redirect handling so we can re-validate every hop's
    // Location through the same SSRF guard. `redirect: "follow"`
    // (the old default) would silently chase a 302 from a public
    // IP to 127.0.0.1 or 169.254.169.254. We cap at 5 hops to
    // avoid loops.
    let resp = null;
    for (let hop = 0; hop < 5; hop++) {
      resp = await fetchWithRetry(
        current.url.toString(),
        {
          method: "GET",
          signal: controller.signal,
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; LSResearchBot/1.0; +https://latinsecurities.com.ar)",
            Accept: "text/html,application/xhtml+xml",
            "Accept-Language": "en-US,en;q=0.9,es;q=0.5",
          },
          redirect: "manual",
        },
        { maxAttempts: 2 },
      );
      // Treat 3xx with a Location header as a hop. Anything else
      // (success or non-redirect error) is the final response.
      const isRedirect = resp.status >= 300 && resp.status < 400 && resp.headers.get("location");
      if (!isRedirect) break;
      const next = new URL(resp.headers.get("location"), current.url).toString();
      const revalidated = await validateUrl(next);
      if (!revalidated.ok) {
        return { ok: false, status: 400, error: `Redirect rejected: ${revalidated.error}` };
      }
      current = revalidated;
    }

    if (!resp || !resp.ok) {
      return { ok: false, status: 502, error: `Upstream returned ${resp?.status ?? "no-response"}` };
    }

    const contentType = (resp.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("html") && !contentType.includes("xml")) {
      return { ok: false, status: 415, error: `Not an HTML page (content-type: ${contentType || "unknown"})` };
    }

    const html = await readCapped(resp);
    const meta = parseMetaFromHtml(html);
    return { ok: true, status: 200, ...meta };
  } catch (err) {
    if (err?.name === "AbortError") {
      return { ok: false, status: 504, error: "Upstream timeout" };
    }
    return { ok: false, status: 500, error: `Fetch failed: ${err?.message || "unknown"}` };
  } finally {
    clearTimeout(timeout);
  }
}
