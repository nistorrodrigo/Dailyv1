// Mass-email send endpoint. Auth via Supabase JWT only:
//
//   Authorization: Bearer <supabase-jwt>
//   The JWT is validated against Supabase; the user's email must end
//   in @latinsecurities.ar (matches LoginGate's domain restriction).
//
// Failed attempts are rate-limited per IP (10 / 15 min via Redis when
// configured). No fallback PIN — the legacy shared-PIN path was removed
// after confirming no cron jobs or external callers depend on it.
//
// Known remaining concerns:
//   - Confirmation email always goes to fromEmail, not the human who clicked
//     send. Pass `confirmTo` from the frontend if you want per-user confirms.
//   - Errors propagate err.message to the client; SendGrid sometimes includes
//     internal hints. Sanitize before returning to keep details out of the UI.
//   - Supabase writes use the anon key. For server-side inserts a service-role
//     key (kept server-only) is the correct choice.

import { createClient } from "@supabase/supabase-js";
import { applyCors } from "./_helpers.js";
import { peekLimit, recordFailure, callerIp } from "./_rateLimit.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Hard-cap on total payload size to keep an oversized PDF from chewing up
// the lambda quietly. Vercel itself caps body size, but we want a clear error.
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5 MB before base64; 6.7 MB after.

// Lock-out budget for failed token validations. Generous enough that a
// legit user can typo their login a few times before getting locked out;
// tight enough that an attacker with a stolen-but-stale token can't loop.
const AUTH_FAIL_MAX = 10;
const AUTH_FAIL_WINDOW_SEC = 15 * 60; // 15 minutes
const ALLOWED_EMAIL_DOMAIN = "latinsecurities.ar";

// Default "From" name when the request doesn't supply one or the value
// fails validation. Recipients see this in their inbox header.
const DEFAULT_FROM_NAME = "Latin Securities Daily";

/**
 * Validate the `fromName` the client wants to use as the From-display
 * name. Returns the trimmed string if it's safe, or null if the caller
 * should fall back to the default.
 *
 * Rules:
 *   - Must be a non-empty trimmed string
 *   - Max 80 characters (RFC 5322 doesn't hard-limit, but anything longer
 *     is almost certainly garbage / abuse)
 *   - Must not contain `<`, `>`, `"`, CR or LF — those are the characters
 *     that could break out of the display-name slot in the From header
 *     and inject extra headers ("From: Foo\nBcc: attacker@…").
 */
function sanitizeFromName(name) {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) return null;
  if (/[<>"\r\n]/.test(trimmed)) return null;
  return trimmed;
}

/**
 * HTML-escape a string before interpolating it into an HTML body.
 * Used for the confirmation email's `subject` and `listName` fields,
 * which are user-controlled and previously got dropped into the
 * confirmation HTML literally — a malformed subject could break the
 * layout or smuggle phishing-looking content into the desk's own
 * inbox. Blast radius is limited (the email goes only to fromEmail)
 * but the cost of escaping is zero so we just do it.
 */
function escHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Try to authenticate via Supabase JWT in the Authorization header.
 * Returns { ok: true, user } if valid; { ok: false, reason } otherwise.
 * `reason` is a short tag for logging — not surfaced to the client.
 */
async function authViaToken(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (!auth || typeof auth !== "string") return { ok: false, reason: "no-header" };
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) return { ok: false, reason: "malformed" };
  const token = m[1].trim();
  if (!token) return { ok: false, reason: "empty-token" };

  try {
    const { data, error } = await supabase.auth.getUser(token);
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

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { html, text, subject, recipients, fromName, isTest, listName, dailyDate, attachments, abTest } = req.body;

  // Rate-limit gate. We `peek` BEFORE validating the token — that way a
  // locked-out IP can't use the success/failure timing channel as a
  // signal about whether their token guess was right.
  const ip = callerIp(req);
  const rl = await peekLimit(`auth-fail:${ip}`, AUTH_FAIL_MAX);
  if (!rl.ok) {
    console.warn(`[send-email] IP ${ip} rate-limited (${rl.count} fails in window)`);
    res.setHeader("Retry-After", String(rl.resetSec || AUTH_FAIL_WINDOW_SEC));
    return res.status(429).json({
      error: `Too many failed attempts. Try again in ${Math.ceil((rl.resetSec || AUTH_FAIL_WINDOW_SEC) / 60)} minutes.`,
    });
  }

  // ── Auth: Supabase JWT only ─────────────────────────────────────
  const tokenAuth = await authViaToken(req);
  if (!tokenAuth.ok) {
    await recordFailure(`auth-fail:${ip}`, AUTH_FAIL_WINDOW_SEC);
    console.warn(
      `[send-email] Auth failed from ${ip} (reason: ${tokenAuth.reason}), ` +
      `recipients=${recipients?.length || 0}`,
    );
    return res.status(403).json({ error: "Your session has expired. Log out and back in to continue." });
  }
  const authedUserEmail = tokenAuth.user.email;

  if (!html || !subject || !recipients?.length) {
    return res.status(400).json({ error: "Missing html, subject, or recipients" });
  }

  // Defensive size check.
  if (attachments?.length) {
    const totalBytes = attachments.reduce((s, a) => s + (a.content ? a.content.length : 0), 0);
    if (totalBytes > MAX_PAYLOAD_BYTES * 1.4) {
      return res.status(413).json({ error: `Attachment too large (${Math.round(totalBytes / 1024 / 1024)} MB). Max ~5 MB.` });
    }
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) return res.status(500).json({ error: "SendGrid not configured." });

  try {
    // Resolve the display name. Prefer what the client sent (validated),
    // fall back to the system default. Doing this *after* sanitization
    // means abusive payloads (header-injection attempts, oversized strings)
    // silently degrade to the safe default rather than rejecting the send.
    const resolvedFromName = sanitizeFromName(fromName) || DEFAULT_FROM_NAME;

    // Build SendGrid payload. Multipart (text/plain + text/html) — RFC says
    // text/plain must come first. Better deliverability and lets recipients
    // with HTML disabled still see something.
    const sgPayload = {
      from: { email: fromEmail, name: resolvedFromName },
      content: text
        ? [
            { type: "text/plain", value: text },
            { type: "text/html", value: html },
          ]
        : [{ type: "text/html", value: html }],
      tracking_settings: {
        open_tracking: { enable: true },
        click_tracking: { enable: true },
      },
    };

    // Per-recipient substitution map. The HTML body contains the token
    // `__LS_RECIPIENT_EMAIL__` inside the unsubscribe URL; SendGrid replaces
    // it with the recipient's email so each person gets their own pre-filled
    // unsubscribe link. (Generic v3 substitutions, not the asm group system.)
    const buildSubstitutions = (recipientEmail) => ({
      "__LS_RECIPIENT_EMAIL__": encodeURIComponent(recipientEmail),
    });

    // Add attachments if present (base64 encoded)
    if (attachments?.length) {
      sgPayload.attachments = attachments.map(a => ({
        content: a.content, // base64
        filename: a.filename,
        type: a.type || "application/pdf",
        disposition: "attachment",
      }));
    }

    // A/B test: split recipients and send two versions
    if (abTest?.enabled && abTest?.subjectB && recipients.length >= 4) {
      const half = Math.floor(recipients.length / 2);
      const groupA = recipients.slice(0, half);
      const groupB = recipients.slice(half);

      // Each recipient gets their own personalization so they don't see other
      // recipients' addresses in the To: header (privacy / GDPR).
      // Send variant A
      await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sgPayload,
          personalizations: groupA.map((email) => ({ to: [{ email }], substitutions: buildSubstitutions(email) })),
          subject: subject + " [A]",
        }),
      });

      // Send variant B
      await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          ...sgPayload,
          personalizations: groupB.map((email) => ({ to: [{ email }], substitutions: buildSubstitutions(email) })),
          subject: abTest.subjectB + " [B]",
        }),
      });

      // Log both
      if (supabase) {
        await supabase.from("email_log").insert([
          { daily_date: dailyDate, subject: subject + " [A]", recipients_count: groupA.length, list_name: listName, is_test: isTest, sent_by: authedUserEmail || fromEmail },
          { daily_date: dailyDate, subject: abTest.subjectB + " [B]", recipients_count: groupB.length, list_name: listName, is_test: isTest, sent_by: authedUserEmail || fromEmail },
        ]).then(() => {}).catch(() => {});
      }

      return res.status(200).json({ ok: true, sent: recipients.length, abTest: true, groupA: groupA.length, groupB: groupB.length });
    }

    // Normal send. One personalization per recipient — otherwise SendGrid
    // puts every address in the same To: header and recipients see each other.
    sgPayload.personalizations = recipients.map((email) => ({
      to: [{ email }],
      substitutions: buildSubstitutions(email),
    }));
    sgPayload.subject = subject;

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sgPayload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SendGrid error ${response.status}: ${text}`);
    }

    // Log to Supabase
    if (supabase) {
      await supabase.from("email_log").insert({
        daily_date: dailyDate || new Date().toISOString().split("T")[0],
        subject,
        recipients_count: recipients.length,
        list_name: listName || null,
        is_test: isTest || false,
        sent_by: authedUserEmail || fromEmail,
      }).then(() => {}).catch(() => {});
    }

    // Send confirmation email to sender
    if (!isTest) {
      await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: fromEmail }] }],
          from: { email: fromEmail, name: "Daily Builder" },
          // The subject going to OUR inbox is allowed to be the literal
          // (header-encoded by SendGrid). The HTML body below escapes
          // user-controlled fields before interpolating.
          subject: `[CONFIRMED] ${subject}`,
          content: [{
            type: "text/html",
            value: `<div style="font-family:'Segoe UI',sans-serif;padding:20px;max-width:500px;">
              <h3 style="color:#000039;margin:0 0 12px;">Daily Sent Successfully</h3>
              <p style="color:#333;font-size:14px;line-height:1.6;">
                <strong>Subject:</strong> ${escHtml(subject)}<br>
                <strong>Recipients:</strong> ${recipients.length}<br>
                ${listName ? `<strong>List:</strong> ${escHtml(listName)}<br>` : ""}
                <strong>Time:</strong> ${new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })} BUE
              </p>
              <p style="color:#888;font-size:12px;">This is an automated confirmation from Daily Builder.</p>
            </div>`,
          }],
        }),
      }).catch(() => {});
    }

    res.status(200).json({ ok: true, sent: recipients.length });
  } catch (err) {
    // Log the full detail server-side for debugging, but return a
    // generic message to the client. SendGrid's error bodies sometimes
    // include API-key fingerprints, sub-user IDs, or internal allowlist
    // hints that we don't want surfaced to the browser.
    console.error("[send-email] send failed:", err?.message || err);
    res.status(500).json({ ok: false, error: "Send failed. Check the server logs and try again." });
  }
}
