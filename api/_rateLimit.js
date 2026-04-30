// Tiny rate limiter backed by Upstash Redis (provisioned via Vercel's
// Marketplace integration — `@vercel/kv` was the old client and is now
// deprecated in favour of `@upstash/redis`, which speaks the same REST
// protocol and reads the same env vars).
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
// Graceful degradation: if Redis isn't configured (no env vars or import
// fails), the helper returns `{ ok: true, skipped: true }` and logs a
// warning. The endpoint still works, just without rate limiting. This
// keeps dev environments and forks running without making KV mandatory.

let clientPromise;

async function getClient() {
  if (clientPromise) return clientPromise;
  clientPromise = (async () => {
    // Vercel's Marketplace integration injects KV_REST_API_URL/_TOKEN.
    // Older deployments may have UPSTASH_REDIS_REST_URL/_TOKEN — accept either.
    const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null; // Not configured.
    try {
      const { Redis } = await import("@upstash/redis");
      return new Redis({ url, token });
    } catch (err) {
      console.warn("[rateLimit] @upstash/redis import failed:", err?.message || err);
      return null;
    }
  })();
  return clientPromise;
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
  const kv = await getClient();
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
  const kv = await getClient();
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
