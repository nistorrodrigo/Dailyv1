// Mass-email send endpoint, gated by a static PIN (env: SEND_EMAIL_PIN).
//
// Known remaining concerns (intentionally not blocking the daily flow):
//   - PIN is shared/static. Real auth = a Supabase session token validated here.
//   - No persistent rate limiting. Failed PINs are logged but not throttled —
//     a brute-force attempt (10k tries for a 4-digit PIN) is feasible. Use
//     @vercel/kv or upstash for atomic counters if this becomes a concern.
//   - Confirmation email always goes to fromEmail, not the human who clicked
//     send. Pass `confirmTo` from the frontend if you want per-user confirms.
//   - Errors propagate err.message to the client; SendGrid sometimes includes
//     internal hints. Sanitize before returning to keep details out of the UI.
//   - Supabase writes use the anon key. For server-side inserts a service-role
//     key (kept server-only) is the correct choice.

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Hard-cap on total payload size to keep an oversized PDF from chewing up
// the lambda quietly. Vercel itself caps body size, but we want a clear error.
const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024; // 5 MB before base64; 6.7 MB after.

/**
 * Set strict CORS: only allow same-origin (no header) and explicitly allowlisted
 * origins from CORS_ALLOWED_ORIGINS (comma-separated). Replaces the previous `*`
 * wildcard that let any site on the internet invoke this endpoint.
 */
function applyCors(req, res) {
  const allowList = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.origin;
  if (origin && allowList.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  // Same-origin browser requests need none of these headers; leaving them off
  // means any unintended cross-origin POST is correctly blocked by the browser.
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { html, text, subject, recipients, pin, isTest, listName, dailyDate, attachments, abTest } = req.body;

  // PIN verification. Any failure is logged with caller IP so brute-force
  // attempts show up in Vercel logs even though we don't have a persistent
  // rate-limit store. (For real rate limiting use @vercel/kv or upstash.)
  const validPin = process.env.SEND_EMAIL_PIN;
  if (!validPin) return res.status(500).json({ error: "SEND_EMAIL_PIN not configured." });
  if (!pin || pin !== validPin) {
    const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
    console.warn(`[send-email] Invalid PIN attempt from ${ip}, recipients=${recipients?.length || 0}`);
    return res.status(403).json({ error: "Invalid PIN. Email not sent." });
  }

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
    // Build SendGrid payload. Multipart (text/plain + text/html) — RFC says
    // text/plain must come first. Better deliverability and lets recipients
    // with HTML disabled still see something.
    const sgPayload = {
      from: { email: fromEmail, name: "Latin Securities Daily" },
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
          { daily_date: dailyDate, subject: subject + " [A]", recipients_count: groupA.length, list_name: listName, is_test: isTest, sent_by: fromEmail },
          { daily_date: dailyDate, subject: abTest.subjectB + " [B]", recipients_count: groupB.length, list_name: listName, is_test: isTest, sent_by: fromEmail },
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
        sent_by: fromEmail,
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
          subject: `[CONFIRMED] ${subject}`,
          content: [{
            type: "text/html",
            value: `<div style="font-family:'Segoe UI',sans-serif;padding:20px;max-width:500px;">
              <h3 style="color:#000039;margin:0 0 12px;">Daily Sent Successfully</h3>
              <p style="color:#333;font-size:14px;line-height:1.6;">
                <strong>Subject:</strong> ${subject}<br>
                <strong>Recipients:</strong> ${recipients.length}<br>
                ${listName ? `<strong>List:</strong> ${listName}<br>` : ""}
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
    res.status(500).json({ ok: false, error: err.message });
  }
}
