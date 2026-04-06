import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");

  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

  try {
    const [dailies, emails, emailsThisMonth] = await Promise.all([
      supabase.from("dailies").select("date, created_at", { count: "exact" }).order("date", { ascending: false }).limit(30),
      supabase.from("email_log").select("*", { count: "exact" }).order("sent_at", { ascending: false }).limit(100),
      supabase.from("email_log").select("*").gte("sent_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    ]);

    const totalDailies = dailies.count || 0;
    const totalEmails = emails.count || 0;
    const emailsMonth = emailsThisMonth.data?.length || 0;
    const testsMonth = emailsThisMonth.data?.filter(e => e.is_test)?.length || 0;
    const totalRecipients = (emails.data || []).reduce((sum, e) => sum + (e.recipients_count || 0), 0);
    const recentDailies = (dailies.data || []).slice(0, 10);
    const recentEmails = (emails.data || []).slice(0, 10);

    // Emails per day (last 7 days)
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      const count = (emails.data || []).filter(e => e.sent_at?.startsWith(ds)).length;
      last7.push({ date: ds.slice(5), count });
    }

    res.status(200).json({
      ok: true,
      stats: { totalDailies, totalEmails, emailsMonth, testsMonth, totalRecipients },
      last7,
      recentDailies,
      recentEmails,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
