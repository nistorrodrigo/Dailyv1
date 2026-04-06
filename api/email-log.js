import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

  const { data, error } = await supabase
    .from("email_log")
    .select("*")
    .order("sent_at", { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.status(200).json({ ok: true, logs: data || [] });
}
