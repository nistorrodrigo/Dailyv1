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
    // POST flips global state that affects every recipient. Restrict
    // to the admin allowlist via LS_ADMIN_EMAILS env var so a single
    // compromised analyst JWT can't change send time / list ID.
    // Empty env var = no admins = POST returns 403 (fail-closed).
    const ADMIN_EMAILS = (process.env.LS_ADMIN_EMAILS || "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const userEmail = (auth.user?.email || "").toLowerCase();
    if (!ADMIN_EMAILS.includes(userEmail)) {
      console.warn(`[schedule] POST denied for ${userEmail} (not in admin allowlist)`);
      return res.status(403).json({ ok: false, error: "Admin only" });
    }

    const { enabled, send_time, timezone, sendgrid_list_id, sendgrid_list_name, recipient_emails, scheduled_date } = req.body || {};

    // Type / format validation — the previous version accepted any
    // JSON shape and pushed it straight to Supabase. A malformed
    // `enabled: "yes"` (string) silently sticks; `send_time:
    // "garbage"` breaks the cron job.
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ ok: false, error: "enabled must be a boolean" });
    }
    if (typeof send_time !== "string" || !/^\d{2}:\d{2}$/.test(send_time)) {
      return res.status(400).json({ ok: false, error: "send_time must be HH:MM" });
    }
    // IANA timezone strings can't be exhaustively validated server-
    // side without an extra dep, but reject the obvious tampering.
    if (typeof timezone !== "string" || timezone.length > 64 || /[\r\n]/.test(timezone)) {
      return res.status(400).json({ ok: false, error: "Invalid timezone" });
    }
    if (sendgrid_list_id != null && typeof sendgrid_list_id !== "string") {
      return res.status(400).json({ ok: false, error: "sendgrid_list_id must be a string" });
    }
    if (sendgrid_list_name != null && typeof sendgrid_list_name !== "string") {
      return res.status(400).json({ ok: false, error: "sendgrid_list_name must be a string" });
    }

    const { data: existing } = await supabase.from("schedule").select("id").limit(1).single();
    if (!existing) return res.status(404).json({ ok: false, error: "No schedule row found" });

    // Note: we don't persist `updated_by` here because the schedule
    // table may not have that column yet — adding it without a
    // schema migration would make every POST fail. Audit trail
    // for who last changed the schedule is in the function logs
    // (the [schedule] POST line above) which is sufficient until
    // a proper `updated_by TEXT` column is added.
    const updateData = {
      enabled,
      send_time,
      timezone,
      sendgrid_list_id,
      sendgrid_list_name,
      updated_at: new Date().toISOString(),
    };
    if (recipient_emails) updateData.recipient_emails = recipient_emails;
    if (scheduled_date) updateData.scheduled_date = scheduled_date;
    console.log(`[schedule] POST by ${userEmail}: enabled=${enabled} send_time=${send_time}`);
    const { error } = await supabase.from("schedule").update(updateData).eq("id", existing.id);

    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true });
  }

  res.status(405).json({ error: "Method not allowed" });
}
