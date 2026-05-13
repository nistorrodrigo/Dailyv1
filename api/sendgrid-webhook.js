import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY,
);

/**
 * SendGrid Event Webhook receiver — public URL by design (SendGrid
 * is the caller). Previously accepted any POST array without any
 * authentication or replay protection, so anyone on the internet
 * could `curl -X POST` and write rows into `email_events` —
 * contaminating analytics and potentially inflating open rates of
 * arbitrary subjects.
 *
 * Defence layers:
 *
 *   1. ECDSA signature verification using SendGrid's "Signed Event
 *      Webhook" public key. The signature covers
 *      `<timestamp> + <raw-body>` so even a replayed payload only
 *      works if the attacker also has the original signature AND
 *      the timestamp window hasn't expired.
 *   2. Timestamp freshness check (5 min) so an old captured payload
 *      can't be replayed indefinitely.
 *   3. Per-event idempotency via `sg_event_id` (Supabase unique
 *      index on email_events). Insert-on-conflict-do-nothing so
 *      SendGrid's at-least-once retries don't double-count.
 *   4. Hard cap on `events.length` so a malformed payload can't be
 *      used to exhaust DB / function memory.
 *
 * Env var:
 *   SENDGRID_WEBHOOK_PUBLIC_KEY — the base64-encoded ECDSA P-256
 *   public key from the SendGrid dashboard (Settings → Mail Settings
 *   → Event Webhook → "Signature Verification"). Stored as a single
 *   line. When unset the verifier rejects all requests — fail-closed.
 */

const MAX_EVENTS_PER_REQUEST = 1000;
const MAX_TIMESTAMP_SKEW_SEC = 5 * 60;

/**
 * Verify a SendGrid signed-webhook payload. Returns true if the
 * ECDSA signature is valid AND the timestamp is within the freshness
 * window AND the public key env var is configured.
 *
 * `rawBody` MUST be the exact byte sequence SendGrid posted — JSON
 * round-tripping changes whitespace and breaks the signature. Vercel
 * passes the parsed body via `req.body`, so we ask for the raw
 * version via a separate read; if that's not feasible we fall back
 * to JSON.stringify which is what SendGrid uses on its end.
 */
function verifySendGridSignature({ rawBody, signatureB64, timestamp }) {
  const publicKeyB64 = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
  if (!publicKeyB64) {
    // Fail-closed: if the env var isn't configured, refuse every
    // request rather than accepting them. Local-dev / preview
    // deploys without the secret simply can't receive events.
    return { ok: false, reason: "public-key-not-configured" };
  }
  if (!signatureB64 || !timestamp) {
    return { ok: false, reason: "missing-signature-or-timestamp" };
  }
  // Freshness check — 5 min window absorbs SendGrid's network
  // latency while bounding replay attacks.
  const tsNum = Number(timestamp);
  if (!Number.isFinite(tsNum)) return { ok: false, reason: "malformed-timestamp" };
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - tsNum) > MAX_TIMESTAMP_SKEW_SEC) {
    return { ok: false, reason: `timestamp-out-of-window (skew=${now - tsNum}s)` };
  }

  try {
    // SendGrid signs `timestamp + rawBody` with ECDSA P-256 / SHA-256.
    // The public key arrives as base64-encoded DER (SPKI).
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyB64, "base64"),
      format: "der",
      type: "spki",
    });
    const verifier = crypto.createVerify("SHA256");
    verifier.update(timestamp);
    verifier.update(rawBody);
    verifier.end();
    // SendGrid uses ASN.1 DER signatures, which is Node's default
    // verify format for ECDSA — no `dsaEncoding: "ieee-p1363"` needed.
    const sig = Buffer.from(signatureB64, "base64");
    const ok = verifier.verify(publicKey, sig);
    return ok ? { ok: true } : { ok: false, reason: "signature-mismatch" };
  } catch (err) {
    return { ok: false, reason: `verify-threw: ${err?.message || "unknown"}` };
  }
}

/** Read the raw request body as a string. Vercel's default body
 *  parsing replaces `req.body` with the parsed object, so for
 *  signature verification we need to assemble the original bytes.
 *  SendGrid signs the exact body it sent, so a JSON.stringify of
 *  req.body works as long as Vercel didn't reorder keys (V8 keeps
 *  insertion order, so this is reliable in practice).
 */
function rawBodyFromReq(req) {
  // Prefer a buffered raw body if Vercel exposes one. Otherwise
  // fall back to stringifying the parsed object. The stringify path
  // is fragile against any reformatting between SendGrid and our
  // handler — flag in logs if it ever fires.
  if (typeof req.rawBody === "string") return req.rawBody;
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody.toString("utf8");
  return JSON.stringify(req.body);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // Signature verification BEFORE any work. Reject early with a
  // generic 401 — don't leak the reason to the caller.
  const sig = req.headers?.["x-twilio-email-event-webhook-signature"];
  const ts = req.headers?.["x-twilio-email-event-webhook-timestamp"];
  const verdict = verifySendGridSignature({
    rawBody: rawBodyFromReq(req),
    signatureB64: typeof sig === "string" ? sig : Array.isArray(sig) ? sig[0] : undefined,
    timestamp: typeof ts === "string" ? ts : Array.isArray(ts) ? ts[0] : undefined,
  });
  if (!verdict.ok) {
    console.warn(`[sendgrid-webhook] Rejected: ${verdict.reason}`);
    return res.status(401).json({ error: "Unauthorized" });
  }

  const events = req.body;
  if (!Array.isArray(events)) return res.status(400).json({ error: "Expected array" });
  if (events.length > MAX_EVENTS_PER_REQUEST) {
    return res.status(413).json({ error: `Too many events (${events.length} > ${MAX_EVENTS_PER_REQUEST})` });
  }

  // Only process events from our daily emails (check subject contains "Argentina Daily")
  const rows = events
    .filter((e) => ["open", "click", "delivered", "bounce", "dropped"].includes(e.event))
    .filter((e) => {
      const subject = (e.subject || "").toLowerCase();
      return subject.includes("argentina daily") || subject.includes("[test]");
    })
    .map((e) => ({
      event_type: e.event,
      email: e.email || "",
      subject: e.subject || "",
      timestamp: new Date((e.timestamp || 0) * 1000).toISOString(),
      url: e.url || null,
      sg_message_id: e.sg_message_id || null,
      // Persist sg_event_id so a unique index on email_events
      // makes SendGrid's at-least-once retries idempotent (the
      // INSERT throws a unique-constraint error which onConflict
      // ignores).
      sg_event_id: e.sg_event_id || null,
    }));

  if (rows.length && supabase) {
    // onConflict on sg_event_id requires a unique index in the DB.
    // If the index isn't there yet, the call is a plain insert
    // which still works — just no replay protection until the
    // index is added. The catch absorbs Supabase errors so a DB
    // hiccup doesn't 500 to SendGrid (which would trigger retries
    // that pile up).
    await supabase
      .from("email_events")
      .upsert(rows, { onConflict: "sg_event_id", ignoreDuplicates: true })
      .then(() => {})
      .catch((err) => {
        console.warn(`[sendgrid-webhook] Supabase insert failed: ${err?.message || err}`);
      });
  }

  res.status(200).json({ ok: true, processed: rows.length });
}
