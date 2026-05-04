import { applyCors, requireAuth, fetchWithRetry } from "./_helpers.js";

/**
 * URL → metadata extractor for the "auto-fill" buttons on report-link
 * inputs (Research Reports, Corporate, Latest Reports). The browser
 * can't fetch arbitrary URLs cross-origin, so the editor calls this
 * server-side instead.
 *
 * Authentication is required — we don't want anonymous traffic
 * burning bandwidth scraping random URLs through us. Same Supabase
 * JWT pattern the rest of /api uses.
 *
 * Response shape (all fields optional — best-effort):
 *   { ok: true, title?, author?, description?, siteName? }
 *
 * Limits we enforce so this can't be turned into an SSRF / DoS:
 *   - URL must be http(s) and parse cleanly
 *   - Hostname must NOT resolve to a private/loopback range (we only
 *     allow public-looking hosts — covers the obvious metadata-server
 *     and 127.0.0.1 cases without needing DNS lookups)
 *   - Response capped at 256 KB (well above any real <head>) so a
 *     malicious server can't feed us a multi-GB stream
 *   - 6-second timeout via AbortController so we never block the
 *     serverless function for long
 */

// Only http(s). data:, javascript:, file: are rejected. We also block
// the obvious private/loopback / link-local ranges by hostname so a
// caller can't trick us into hitting the cloud-metadata service.
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
const MAX_BYTES = 256 * 1024;
async function readCapped(resp) {
  const reader = resp.body?.getReader?.();
  if (!reader) {
    // Fallback for runtimes without streaming Response.body — read
    // everything up front and slice. Same cap.
    const text = await resp.text();
    return text.slice(0, MAX_BYTES);
  }
  const decoder = new TextDecoder("utf-8");
  let total = 0;
  let buf = "";
  while (total < MAX_BYTES) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    buf += decoder.decode(value, { stream: true });
    if (total >= MAX_BYTES) break;
  }
  try {
    await reader.cancel();
  } catch {
    // best-effort cleanup
  }
  return buf;
}

// Tag-stripping regex pulls cover most reasonable HTML. We don't
// import a full parser — that adds ~500 KB to the cold-start cost
// and we only need three or four fields. The patterns below tolerate
// single/double quotes and arbitrary attribute order.
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

function extractMeta(html) {
  // Title: prefer og:title (publishers usually set this richer than
  // the raw <title> for sharing previews), then twitter:title, then
  // the document <title>.
  const ogTitle = pickMeta(html, ["og:title", "twitter:title"]);
  let title = ogTitle;
  if (!title) {
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    if (m && m[1]) title = decodeEntities(m[1].replace(/\s+/g, " ")).trim();
  }
  // Author: rarely on a single canonical tag. Try the publisher's
  // schema.org markup, common WordPress / news-site conventions.
  const author = pickMeta(html, ["author", "article:author", "twitter:creator", "dc.creator"]);
  // Description / site name — useful as fallback when title is generic.
  const description = pickMeta(html, ["og:description", "twitter:description", "description"]);
  const siteName = pickMeta(html, ["og:site_name", "application-name"]);
  return {
    title: title || undefined,
    author: author || undefined,
    description: description || undefined,
    siteName: siteName || undefined,
  };
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  // Auth gate — every other authenticated endpoint goes through this.
  // Surfacing a 401 to anonymous callers also stops automated scrapers
  // from using us as an open proxy.
  const auth = await requireAuth(req);
  if (!auth.ok) return res.status(401).json({ ok: false, error: "Auth required" });

  const { url } = req.body || {};
  if (typeof url !== "string" || !url.trim()) {
    return res.status(400).json({ ok: false, error: "Missing url" });
  }

  const v = validateUrl(url.trim());
  if (!v.ok) return res.status(400).json({ ok: false, error: v.error });

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
        // Pretend to be a normal browser. Some publishers 403 default
        // node user-agents. `Accept-Language: en` discourages being
        // served the localized variant the analyst didn't ask for.
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
      return res.status(502).json({
        ok: false,
        error: `Upstream returned ${resp.status}`,
      });
    }

    // Sanity check the content-type before we parse — PDFs / binary
    // attachments would just produce noise.
    const contentType = (resp.headers.get("content-type") || "").toLowerCase();
    if (!contentType.includes("html") && !contentType.includes("xml")) {
      return res.status(415).json({
        ok: false,
        error: `Not an HTML page (content-type: ${contentType || "unknown"})`,
      });
    }

    const html = await readCapped(resp);
    const meta = extractMeta(html);

    return res.status(200).json({ ok: true, ...meta });
  } catch (err) {
    if (err?.name === "AbortError") {
      return res.status(504).json({ ok: false, error: "Upstream timeout" });
    }
    return res.status(500).json({
      ok: false,
      error: `Fetch failed: ${err?.message || "unknown"}`,
    });
  } finally {
    clearTimeout(timeout);
  }
}
