import { createClient } from "@supabase/supabase-js";
import { applyCors, requireAuth } from "./_helpers.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();

  // ── Auth gate ────────────────────────────────────────────────────
  // GET leaks the desk's scheduled-send config (recipient list ID +
  // name, send time, last-sent timestamp). POST lets anyone schedule
  // a daily blast to the institutional list. Both require a valid
  // analyst session — same JWT pattern as analytics, ai-draft, and
  // send-email.
  const auth = await requireAuth(req);
  if (!auth.ok) {
    console.warn(`[schedule] auth failed: ${auth.reason}`);
    return res.status(401).json({ ok: false, error: "Authentication required" });
  }

  if (req.method === "GET") {
    const { data, error } = await supabase.from("schedule").select("*").limit(1).single();
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, schedule: data });
  }

  if (req.method === "POST") {
    const { enabled, send_time, timezone, sendgrid_list_id, sendgrid_list_name, recipient_emails, scheduled_date } = req.body;

    const { data: existing } = await supabase.from("schedule").select("id").limit(1).single();
    if (!existing) return res.status(404).json({ ok: false, error: "No schedule row found" });

    const updateData = { enabled, send_time, timezone, sendgrid_list_id, sendgrid_list_name, updated_at: new Date().toISOString() };
    if (recipient_emails) updateData.recipient_emails = recipient_emails;
    const { error } = await supabase.from("schedule").update(updateData).eq("id", existing.id);

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
