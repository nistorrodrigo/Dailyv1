import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");

  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

  const { data: events } = await supabase
    .from("email_events")
    .select("*")
    .order("timestamp", { ascending: false })
    .limit(200);

  // Aggregate stats
  const all = events || [];
  const opens = all.filter(e => e.event_type === "open");
  const clicks = all.filter(e => e.event_type === "click");
  const delivered = all.filter(e => e.event_type === "delivered");
  const bounces = all.filter(e => e.event_type === "bounce");

  // Unique openers
  const uniqueOpeners = [...new Set(opens.map(e => e.email))];

  // Top openers
  const openerCounts = {};
  opens.forEach(e => { openerCounts[e.email] = (openerCounts[e.email] || 0) + 1; });
  const topOpeners = Object.entries(openerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([email, count]) => ({ email, count }));

  // Recent events
  const recent = all.slice(0, 30);

  res.status(200).json({
    ok: true,
    stats: {
      totalOpens: opens.length,
      uniqueOpens: uniqueOpeners.length,
      totalClicks: clicks.length,
      totalDelivered: delivered.length,
      totalBounces: bounces.length,
    },
    topOpeners,
    recent,
  });
}
