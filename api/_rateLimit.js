// Tiny rate limiter backed by Vercel KV (Upstash Redis under the hood).
//
// Pattern: fixed-window counter per (key, window). The first failure
// initialises the counter and sets a TTL equal to the window. Subsequent
// failures within the window increment. Once the counter exceeds `max`,
// further calls are denied until the window expires.
//
// We use this only on the PIN-failure path of /api/send-email — successful
// sends shouldn't be rate-limited. Same address can keep trying with the
// correct PIN forever; an attacker brute-forcing gets locked out fast.
//
// Graceful degradation: if KV isn't configured (no env vars or import
// fails), the helper returns `{ ok: true, skipped: true }` and logs a
// warning. The endpoint still works, just without rate limiting. This
// keeps dev environments and forks running without making KV mandatory.

let kvPromise;

async function getKv() {
  if (kvPromise) return kvPromise;
  kvPromise = (async () => {
    if (!process.env.KV_REST_API_URL && !process.env.KV_URL) {
      return null; // Not configured.
    }
    try {
      const mod = await import("@vercel/kv");
      return mod.kv;
    } catch (err) {
      console.warn("[rateLimit] @vercel/kv import failed:", err?.message || err);
      return null;
    }
  })();
  return kvPromise;
}

/**
 * Read the current count for `key` WITHOUT incrementing. Use this to
 * gate an action when an IP has already failed too many times — it lets
 * us reject without giving the attacker timing signal about whether
 * their input was correct.
 *
 * @returns {Promise<{ok: boolean, count: number, resetSec?: number, skipped?: boolean}>}
 */
export async function peekLimit(key, max) {
  const kv = await getKv();
  if (!kv) return { ok: true, count: 0, skipped: true };
  try {
    const raw = await kv.get(key);
    const count = typeof raw === "number" ? raw : (parseInt(raw, 10) || 0);
    if (count > max) {
      const ttl = await kv.ttl(key);
      return { ok: false, count, resetSec: ttl > 0 ? ttl : 0 };
    }
    return { ok: true, count };
  } catch (err) {
    console.warn("[rateLimit] peek failed, allowing through:", err?.message || err);
    return { ok: true, count: 0, skipped: true };
  }
}

/**
 * Increment `key` by one. If the key didn't exist, sets a TTL of
 * `windowSec` so the counter clears at window end. Use this on a
 * failure path to record the failure for rate limiting.
 */
export async function recordFailure(key, windowSec) {
  const kv = await getKv();
  if (!kv) return;
  try {
    const count = await kv.incr(key);
    if (count === 1) {
      await kv.expire(key, windowSec);
    }
  } catch (err) {
    console.warn("[rateLimit] recordFailure failed:", err?.message || err);
  }
}

/** Best-effort caller IP derivation, with a fallback so the key is always defined. */
export function callerIp(req) {
  const xff = req.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  if (Array.isArray(xff) && xff.length) return xff[0];
  return req.socket?.remoteAddress || "unknown";
}
