// Tiny rate limiter backed by Redis. Connects via the standard TCP protocol
// using `ioredis`, which is what Vercel's "Connect Database → Redis" flow
// gives you (the auto-injected `REDIS_URL` env var). Works with Upstash,
// Redis Cloud, self-hosted, anything speaking the wire protocol.
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
// keeps dev environments and forks running without making Redis mandatory.

let clientPromise;

async function getClient() {
  if (clientPromise) return clientPromise;
  clientPromise = (async () => {
    // Vercel's Redis integration injects `REDIS_URL`. Some setups also
    // expose `KV_URL` (legacy) — accept either.
    const url = process.env.REDIS_URL || process.env.KV_URL;
    if (!url) return null; // Not configured.
    try {
      const { default: Redis } = await import("ioredis");
      // lazyConnect avoids opening a TCP socket at import time. Each
      // invocation that actually calls peek/incr triggers the connect
      // and lets the lambda exit cleanly when done.
      return new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 });
    } catch (err) {
      console.warn("[rateLimit] ioredis import failed:", err?.message || err);
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
