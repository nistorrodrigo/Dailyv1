import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const events = req.body;
  if (!Array.isArray(events)) return res.status(400).json({ error: "Expected array" });

  const rows = events
    .filter(e => ["open", "click", "delivered", "bounce", "dropped"].includes(e.event))
    .map(e => ({
      event_type: e.event,
      email: e.email || "",
      subject: e.subject || "",
      timestamp: new Date((e.timestamp || 0) * 1000).toISOString(),
      url: e.url || null,
      sg_message_id: e.sg_message_id || null,
    }));

  if (rows.length && supabase) {
    await supabase.from("email_events").insert(rows).then(() => {}).catch(() => {});
  }

  res.status(200).json({ ok: true, processed: rows.length });
}
