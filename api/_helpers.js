// Shared utilities for the Vercel serverless functions in /api.
//
// Note: this file is named with a leading underscore so Vercel doesn't
// expose it as its own /api/_helpers route. (Vercel uses the file path
// to derive routes, but underscore-prefixed files are treated as
// support modules.)

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

/** Hostnames we refuse to fetch (SSRF guard). Covers loopback, RFC
 *  1918 private ranges, link-local, and the cloud-metadata IPs. The
 *  cloud-metadata service in particular is the classic SSRF target
 *  on AWS / GCP, returning instance credentials to anyone who can
 *  GET 169.254.169.254. */
const BLOCKED_HOSTNAME_PREFIXES = [
  "localhost",
  "127.",
  "10.",
  "169.254.",
  "192.168.",
  "0.0.0.0",
  "::1",
];
// 172.16.0.0/12 → 172.16. through 172.31.
const BLOCKED_172 = /^172\.(1[6-9]|2\d|3[01])\./;

function isBlockedHost(hostname) {
  const lower = hostname.toLowerCase();
  if (BLOCKED_HOSTNAME_PREFIXES.some((p) => lower === p.replace(/\.$/, "") || lower.startsWith(p))) {
    return true;
  }
  if (BLOCKED_172.test(lower)) return true;
  return false;
}

function validateUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, error: "Invalid URL" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, error: "Only http and https URLs are supported" };
  }
  if (isBlockedHost(u.hostname)) {
    return { ok: false, error: "Hostname not allowed" };
  }
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
  const v = validateUrl(rawUrl.trim());
  if (!v.ok) return { ok: false, status: 400, error: v.error };

  // 6s ceiling — slow CDNs / Cloudflare-protected sites occasionally
  // dribble TTFB. Past that we bail rather than hold the function
  // open and run up Vercel's per-invocation budget.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const resp = await fetchWithRetry(
      v.url.toString(),
      {
        method: "GET",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; LSResearchBot/1.0; +https://latinsecurities.com.ar)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9,es;q=0.5",
        },
        redirect: "follow",
      },
      { maxAttempts: 2 },
    );

    if (!resp.ok) {
      return { ok: false, status: 502, error: `Upstream returned ${resp.status}` };
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
