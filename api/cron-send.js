import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Verify cron secret (Vercel sends this header)
  const authHeader = req.headers["authorization"];
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Get schedule config
    const { data: schedule } = await supabase.from("schedule").select("*").limit(1).single();
    if (!schedule || !schedule.enabled) {
      return res.status(200).json({ ok: true, message: "Schedule disabled, skipping" });
    }

    // Check if already sent today
    const today = new Date().toISOString().split("T")[0];
    if (schedule.last_sent_date === today) {
      return res.status(200).json({ ok: true, message: "Already sent today" });
    }

    // Check if it's the right time (within 30min window)
    const now = new Date();
    const tz = schedule.timezone || "America/Argentina/Buenos_Aires";
    const localTime = now.toLocaleTimeString("en-US", { timeZone: tz, hour12: false, hour: "2-digit", minute: "2-digit" });
    const [schedH, schedM] = schedule.send_time.split(":").map(Number);
    const [nowH, nowM] = localTime.split(":").map(Number);
    const schedMin = schedH * 60 + schedM;
    const nowMin = nowH * 60 + nowM;

    if (nowMin < schedMin || nowMin > schedMin + 30) {
      return res.status(200).json({ ok: true, message: `Not time yet. Now: ${localTime}, scheduled: ${schedule.send_time}` });
    }

    // Get today's daily from Supabase
    const { data: daily } = await supabase.from("dailies").select("state").eq("date", today).single();
    if (!daily?.state) {
      return res.status(200).json({ ok: true, message: "No daily found for today" });
    }

    // Build recipients list
    let recipients = [];
    if (schedule.sendgrid_list_id) {
      // Fetch contacts from SendGrid list
      const sgResp = await fetch("https://api.sendgrid.com/v3/marketing/contacts/search", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: `CONTAINS(list_ids, '${schedule.sendgrid_list_id}')` }),
      });
      const sgData = await sgResp.json();
      recipients = (sgData.result || []).map(c => c.email);
    } else if (schedule.recipient_emails?.length) {
      recipients = schedule.recipient_emails;
    }

    if (!recipients.length) {
      return res.status(200).json({ ok: true, message: "No recipients configured" });
    }

    // Generate HTML (import dynamically to avoid bundling logos in cron)
    // We use the state directly to build a simple version
    const { formatDate } = await import("../src/utils/dates.js");
    const subject = `Argentina Daily - ${formatDate(today)}`;

    // Send via SendGrid
    const sendResp = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [{ to: recipients.map(email => ({ email })) }],
        from: { email: process.env.SENDGRID_FROM_EMAIL, name: "Latin Securities Daily" },
        subject,
        content: [{ type: "text/html", value: daily.state._lastHtml || "<p>Daily report</p>" }],
      }),
    });

    if (!sendResp.ok) {
      const err = await sendResp.text();
      throw new Error(`SendGrid ${sendResp.status}: ${err}`);
    }

    // Update last sent
    await supabase.from("schedule").update({
      last_sent_at: new Date().toISOString(),
      last_sent_date: today,
    }).eq("id", schedule.id);

    res.status(200).json({ ok: true, sent: recipients.length, date: today });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export const config = {
  schedule: "*/15 7-8 * * 1-5",
};
