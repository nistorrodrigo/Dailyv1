export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { html, subject, recipients } = req.body;

  if (!html || !subject || !recipients?.length) {
    return res.status(400).json({ error: "Missing html, subject, or recipients" });
  }

  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    return res.status(500).json({ error: "SendGrid not configured. Set SENDGRID_API_KEY and SENDGRID_FROM_EMAIL env vars." });
  }

  try {
    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{
          to: recipients.map((email) => ({ email })),
        }],
        from: { email: fromEmail, name: "Latin Securities Daily" },
        subject,
        content: [{
          type: "text/html",
          value: html,
        }],
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SendGrid error ${response.status}: ${text}`);
    }

    res.status(200).json({ ok: true, sent: recipients.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
