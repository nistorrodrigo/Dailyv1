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
