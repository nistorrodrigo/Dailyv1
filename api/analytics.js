import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");

  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

  const { type } = req.query;

  // /api/analytics?type=email-log
  if (type === "email-log") {
    const { data, error } = await supabase
      .from("email_log")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(50);
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, logs: data || [] });
  }

  // /api/analytics?type=email-events
  if (type === "email-events") {
    const { data: events } = await supabase
      .from("email_events")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(200);

    const all = events || [];
    const opens = all.filter(e => e.event_type === "open");
    const clicks = all.filter(e => e.event_type === "click");
    const delivered = all.filter(e => e.event_type === "delivered");
    const bounces = all.filter(e => e.event_type === "bounce");
    const uniqueOpeners = [...new Set(opens.map(e => e.email))];
    const openerCounts = {};
    opens.forEach(e => { openerCounts[e.email] = (openerCounts[e.email] || 0) + 1; });
    const topOpeners = Object.entries(openerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([email, count]) => ({ email, count }));

    return res.status(200).json({
      ok: true,
      stats: {
        totalOpens: opens.length,
        uniqueOpens: uniqueOpeners.length,
        totalClicks: clicks.length,
        totalDelivered: delivered.length,
        totalBounces: bounces.length,
      },
      topOpeners,
      recent: all.slice(0, 30),
    });
  }

  // Default: /api/analytics (dashboard stats)
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
      recentDailies: (dailies.data || []).slice(0, 10),
      recentEmails: (emails.data || []).slice(0, 10),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
