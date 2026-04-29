// Unsubscribe endpoint.
//
// GET  /api/unsubscribe                -> renders a simple branded form asking for the email address
// GET  /api/unsubscribe?email=foo@x... -> pre-fills the form with the email
// POST /api/unsubscribe (form data: email=...) -> adds the email to the SendGrid
//                                                  global suppression group and
//                                                  returns a confirmation page
//
// Adding to the global suppression list is SendGrid's documented
// unsubscribe primitive — once on the list, SendGrid refuses to deliver
// any further mail to that recipient from this account, regardless of
// which list they were imported from.
// See: https://docs.sendgrid.com/api-reference/suppressions-global-suppressions

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

export default async function handler(req, res) {
  if (req.method === "GET") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    const prefill = req.query?.email ? String(req.query.email) : "";
    return res.status(200).send(formPage(prefill));
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // The form posts application/x-www-form-urlencoded which Vercel auto-parses
  // into req.body. Fall back to the JSON shape for callers that prefer it.
  const raw = (req.body?.email || req.body || "").toString().trim();
  const email = raw.toLowerCase();

  if (!email || !email.includes("@") || email.length > 254) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(400).send(formPage(raw, "Please enter a valid email address."));
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(500).send(errorPage("Server misconfigured (SENDGRID_API_KEY missing)."));
  }

  try {
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
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(successPage(email));
  } catch (err) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(500).send(errorPage(err.message));
  }
}
