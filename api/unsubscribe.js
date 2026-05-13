// Unsubscribe endpoint.
//
// GET  /api/unsubscribe?email=foo&t=HMAC -> 1-click unsubscribe via
//                                            HMAC-signed link from a
//                                            sent daily. Suppresses
//                                            immediately on success.
// GET  /api/unsubscribe                  -> manual form (no token)
// POST /api/unsubscribe (form: email=)   -> rate-limited path for
//                                            recipients who lost the
//                                            link or are typing the
//                                            address by hand. 5/IP/hr.
//
// The HMAC is generated per-recipient in api/send-email.js at send
// time (substitution token `__LS_RECIPIENT_HMAC__`) using the env
// var `UNSUBSCRIBE_HMAC_SECRET`. Without a matching token, the
// only way to suppress an address is the rate-limited form — so
// an attacker can't mass-suppress arbitrary inboxes by guessing.
//
// Adding to the global suppression list is SendGrid's documented
// unsubscribe primitive — once on the list, SendGrid refuses to deliver
// any further mail to that recipient from this account, regardless of
// which list they were imported from.
// See: https://docs.sendgrid.com/api-reference/suppressions-global-suppressions

import crypto from "node:crypto";
import { peekLimit, recordFailure, callerIp } from "./_rateLimit.js";

/** Constant-time compare so HMAC verification doesn't leak
 *  byte-by-byte timing info. */
function timingSafeEqualStrings(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function unsubscribeHmac(email) {
  const secret = process.env.UNSUBSCRIBE_HMAC_SECRET;
  if (!secret) return null;
  return crypto
    .createHmac("sha256", secret)
    .update(email.toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

// Rate-limit budget for the manual-form (no-token) path. Tight
// because an attacker who can pass through this path can suppress
// any email they guess. 5 per IP per hour absorbs a legitimate
// re-attempt while bounding abuse to a trivial scale.
const MANUAL_UNSUB_MAX = 5;
const MANUAL_UNSUB_WINDOW_SEC = 60 * 60;

const NAVY = "#000039";
const SKY = "#3399ff";
const BLUE = "#1e5ab0";
const GREEN = "#27864a";
const RED = "#c0392b";
const GREY = "#666";

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wrap content in the same minimal branded shell used for the form/success/error pages. */
function page(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${escapeHtml(title)} — Latin Securities</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 0;
      font-family: 'Segoe UI', Calibri, Arial, Helvetica, sans-serif;
      background: #f4f5f7; color: #2c2c2c;
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
    }
    .card {
      background: #fff; border: 1px solid #e8eaed; border-radius: 8px;
      max-width: 440px; width: calc(100% - 32px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    }
    .header { background: ${NAVY}; padding: 24px 28px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; color: #fff; font-size: 18px; font-weight: 600; letter-spacing: 0.3px; }
    .header .subtitle { color: ${SKY}; font-size: 10px; letter-spacing: 1.4px; text-transform: uppercase; font-weight: 600; margin-top: 4px; }
    .body { padding: 28px; }
    .body p { margin: 0 0 14px; line-height: 1.55; font-size: 14px; }
    label { display: block; font-size: 11px; font-weight: 600; color: ${GREY}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    input[type="email"] {
      width: 100%; padding: 10px 12px; border: 1px solid #d4d8dd; border-radius: 6px;
      font-size: 14px; font-family: inherit; color: #2c2c2c;
    }
    input[type="email"]:focus { outline: none; border-color: ${BLUE}; box-shadow: 0 0 0 2px rgba(30,90,176,0.15); }
    button {
      margin-top: 16px; width: 100%; padding: 11px 18px; border: none; border-radius: 6px;
      background: ${BLUE}; color: #fff; font-size: 13px; font-weight: 700; letter-spacing: 0.5px;
      text-transform: uppercase; cursor: pointer;
    }
    button:hover { background: #2868c8; }
    .success { color: ${GREEN}; font-weight: 600; }
    .error { color: ${RED}; font-weight: 600; }
    .footer { padding: 14px 28px 22px; font-size: 11px; color: ${GREY}; line-height: 1.5; }
    .footer a { color: ${BLUE}; text-decoration: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>Latin Securities</h1>
      <div class="subtitle">Email Preferences</div>
    </div>
    <div class="body">
      ${bodyHtml}
    </div>
    <div class="footer">
      Latin Securities S.A. · <a href="https://www.latinsecurities.com.ar">latinsecurities.com.ar</a>
    </div>
  </div>
</body>
</html>`;
}

function formPage(prefillEmail = "", errorMsg = "") {
  return page(
    "Unsubscribe",
    `
    <p>Enter your email address to stop receiving the <strong>Latin Securities Argentina Daily</strong>.</p>
    ${errorMsg ? `<p class="error">${escapeHtml(errorMsg)}</p>` : ""}
    <form method="POST" action="/api/unsubscribe">
      <label for="email">Email address</label>
      <input id="email" type="email" name="email" required autocomplete="email" placeholder="you@example.com" value="${escapeHtml(prefillEmail)}" />
      <button type="submit">Unsubscribe</button>
    </form>
    `,
  );
}

function successPage(email) {
  return page(
    "Unsubscribed",
    `
    <p class="success">${escapeHtml(email)} has been unsubscribed.</p>
    <p>You will no longer receive the Latin Securities Argentina Daily. If you change your mind, contact your sales representative to be re-added.</p>
    `,
  );
}

function errorPage(msg) {
  return page(
    "Unsubscribe failed",
    `
    <p class="error">${escapeHtml(msg)}</p>
    <p>If the problem persists, please contact <a href="mailto:daily@latinsecurities.ar">daily@latinsecurities.ar</a>.</p>
    `,
  );
}

// If SendGrid didn't substitute (e.g. the HTML was pasted into Code Editor
// instead of sent via the API), the token comes through literally and
// shouldn't be pre-filled into the form.
const SUBSTITUTION_TOKEN = "__LS_RECIPIENT_EMAIL__";
const HMAC_SUBSTITUTION_TOKEN = "__LS_RECIPIENT_HMAC__";

/** The actual SendGrid global-suppression POST. Returns nothing
 *  on success; throws on error so callers can render an error
 *  page. */
async function suppressEmail(email) {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) throw new Error("Server misconfigured (SENDGRID_API_KEY missing).");
  const sgResp = await fetch("https://api.sendgrid.com/v3/asm/suppressions/global", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_emails: [email] }),
  });
  if (!sgResp.ok) {
    const text = await sgResp.text();
    console.warn(`[unsubscribe] SendGrid ${sgResp.status} for ${email}: ${text}`);
    throw new Error(`Could not register the unsubscribe (SendGrid returned ${sgResp.status}).`);
  }
  console.log(`[unsubscribe] global-suppressed ${email}`);
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");

  // ── GET: 1-click unsubscribe IF the URL has a valid HMAC token
  //        Otherwise (no token / bad token / literal SendGrid
  //        substitution tokens / no email) fall through to the
  //        manual form.
  if (req.method === "GET") {
    const rawEmail = req.query?.email ? String(req.query.email) : "";
    const rawToken = req.query?.t ? String(req.query.t) : "";
    const emailLiteral = rawEmail === SUBSTITUTION_TOKEN || rawEmail === "";
    const tokenLiteral = rawToken === HMAC_SUBSTITUTION_TOKEN || rawToken === "";

    // Token present + email present + secret configured → verify.
    if (!emailLiteral && !tokenLiteral) {
      const email = decodeURIComponent(rawEmail).trim().toLowerCase();
      const expected = unsubscribeHmac(email);
      if (expected && timingSafeEqualStrings(rawToken, expected)) {
        try {
          await suppressEmail(email);
          return res.status(200).send(successPage(email));
        } catch (err) {
          return res.status(500).send(errorPage(err.message));
        }
      }
      // HMAC mismatch — don't reveal which step failed (could
      // leak whether the email exists in our list). Just drop to
      // the manual form with a generic prompt.
      return res.status(200).send(formPage(email, "Link expired or invalid. Enter your email to unsubscribe."));
    }

    // No usable token — show the form, optionally pre-filled.
    const prefill = emailLiteral ? "" : decodeURIComponent(rawEmail);
    return res.status(200).send(formPage(prefill));
  }

  // ── POST: manual form path. Rate-limited per IP to bound abuse.
  if (req.method !== "POST") {
    res.setHeader("Content-Type", "application/json");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = callerIp(req);
  const rl = await peekLimit(`unsub-manual:${ip}`, MANUAL_UNSUB_MAX);
  if (!rl.ok) {
    res.setHeader("Retry-After", String(rl.resetSec || MANUAL_UNSUB_WINDOW_SEC));
    return res.status(429).send(errorPage(
      `Too many unsubscribe attempts from this IP. Try again in ${Math.ceil((rl.resetSec || MANUAL_UNSUB_WINDOW_SEC) / 60)} minutes.`,
    ));
  }

  // The form posts application/x-www-form-urlencoded which Vercel auto-parses
  // into req.body. Fall back to the JSON shape for callers that prefer it.
  const raw = (req.body?.email || req.body || "").toString().trim();
  const email = raw.toLowerCase();

  if (!email || !email.includes("@") || email.length > 254) {
    await recordFailure(`unsub-manual:${ip}`, MANUAL_UNSUB_WINDOW_SEC);
    return res.status(400).send(formPage(raw, "Please enter a valid email address."));
  }

  try {
    await suppressEmail(email);
    // Charge the rate limit on success too — a successful manual
    // unsub still counts toward the 5/hr/IP budget, since the
    // attack we're bounding IS successful suppressions.
    await recordFailure(`unsub-manual:${ip}`, MANUAL_UNSUB_WINDOW_SEC);
    return res.status(200).send(successPage(email));
  } catch (err) {
    return res.status(500).send(errorPage(err.message));
  }
}
