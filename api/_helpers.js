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
