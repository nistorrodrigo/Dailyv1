import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { html, subject, recipients, pin, isTest, listName, dailyDate } = req.body;

  // PIN verification
  const validPin = process.env.SEND_EMAIL_PIN;
  if (!validPin) return res.status(500).json({ error: "SEND_EMAIL_PIN not configured." });
  if (!pin || pin !== validPin) return res.status(403).json({ error: "Invalid PIN. Email not sent." });

  if (!html || !subject || !recipients?.length) {
    return res.status(400).json({ error: "Missing html, subject, or recipients" });
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!apiKey || !fromEmail) return res.status(500).json({ error: "SendGrid not configured." });

  try {
    // Send the daily email
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: recipients.map((email) => ({ email })) }],
        from: { email: fromEmail, name: "Latin Securities Daily" },
        subject,
        content: [{ type: "text/html", value: html }],
        tracking_settings: {
          open_tracking: { enable: true },
          click_tracking: { enable: true },
        },
      }),
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
