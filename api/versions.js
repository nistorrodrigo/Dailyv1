import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { date } = req.query;

  if (req.method === "POST") {
    // Save a named version snapshot
    const { state, label } = req.body;
    if (!date || !state) return res.status(400).json({ error: "Missing date or state" });

    const { error } = await supabase.from("daily_versions").insert({
      daily_date: date,
      label: label || `v${Date.now()}`,
      state,
    });
    if (error) {
      // Table might not exist yet — create it
      if (error.code === "42P01") {
        return res.status(200).json({ ok: false, error: "daily_versions table not created yet" });
      }
      return res.status(500).json({ ok: false, error: error.message });
    }
    return res.status(200).json({ ok: true });
  }

  // GET — list versions for a date
  if (!date) return res.status(400).json({ error: "Missing date param" });
  const { data, error } = await supabase
    .from("daily_versions")
    .select("id, daily_date, label, created_at")
    .eq("daily_date", date)
    .order("created_at", { ascending: false });

  if (error) return res.status(200).json({ ok: true, versions: [] });
  res.status(200).json({ ok: true, versions: data || [] });
}
