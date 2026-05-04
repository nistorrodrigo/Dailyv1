import { createClient } from "@supabase/supabase-js";
import { applyCors, requireAuth } from "./_helpers.js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") return res.status(200).end();

  if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

  // ── Auth gate ────────────────────────────────────────────────────
  // Every analytics branch returns analyst-private data: send history
  // with sender emails, recipient open/click events with subscriber
  // email addresses, etc. Without this gate any anonymous request to
  // /api/analytics?type=email-events would scrape the institutional
  // distribution list. Cache-Control is `private` so the Vercel CDN
  // never serves an authed response to a different user.
  const auth = await requireAuth(req);
  if (!auth.ok) {
    console.warn(`[analytics] auth failed: ${auth.reason}`);
    return res.status(401).json({ error: "Authentication required" });
  }
  res.setHeader("Cache-Control", "private, max-age=15, stale-while-revalidate=30");

  const { type, date } = req.query;

  // /api/analytics?type=email-log
  // Optional ?date=YYYY-MM-DD filter — narrows to a specific daily_date
  // so the Send panel can quickly check "was today already sent?" without
  // pulling 50 rows.
  if (type === "email-log") {
    let query = supabase
      .from("email_log")
      .select("*")
      .order("sent_at", { ascending: false });
    if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      query = query.eq("daily_date", date).limit(10);
    } else {
      query = query.limit(50);
    }
    const { data, error } = await query;
    if (error) return res.status(500).json({ ok: false, error: error.message });
    return res.status(200).json({ ok: true, logs: data || [] });
  }

  // /api/analytics?type=per-daily-stats
  // Returns the last N email_log rows joined with their event counts.
  // Lets the Dashboard render "Argentina Daily — Apr 28 — 1247 sent /
  // 67% open / 12% click" rows. Open/click rates are over delivered
  // count when available, else over recipients_count as a fallback.
  if (type === "per-daily-stats") {
    // Pull 20 rows (~4 business weeks at 5 dailies/week) so the
    // Dashboard's WoW digest panel has enough lookback to compute
    // both this-week and last-week averages without a second
    // query. The per-row table on the same tab still slices to 10.
    const { data: logs, error: logErr } = await supabase
      .from("email_log")
      .select("id, daily_date, subject, recipients_count, list_name, is_test, sent_at, sent_by")
      .eq("is_test", false)
      .order("sent_at", { ascending: false })
      .limit(20);
    if (logErr) return res.status(500).json({ ok: false, error: logErr.message });

    const rows = logs || [];
    if (rows.length === 0) return res.status(200).json({ ok: true, rows: [] });

    // Pull events for the same window. We grab a generous limit and
    // bucket by subject in Node — avoids a per-row count() query that
    // would round-trip the DB N times.
    const oldest = rows[rows.length - 1].sent_at;
    const { data: events } = await supabase
      .from("email_events")
      .select("subject, event_type, email")
      .gte("timestamp", oldest);

    // Bucket by subject. Track unique opens/clicks (per email) separately
    // from raw counts so we can show both "1,000 opens" and "812 unique
    // opens" — the former says how engaged readers are, the latter how
    // much of the list opened at all.
    const byKey = new Map();
    for (const ev of events || []) {
      const k = ev.subject || "(no subject)";
      let bucket = byKey.get(k);
      if (!bucket) {
        bucket = { delivered: 0, opens: 0, clicks: 0, bounces: 0, uniqueOpeners: new Set(), uniqueClickers: new Set() };
        byKey.set(k, bucket);
      }
      if (ev.event_type === "delivered") bucket.delivered++;
      else if (ev.event_type === "open") { bucket.opens++; if (ev.email) bucket.uniqueOpeners.add(ev.email); }
      else if (ev.event_type === "click") { bucket.clicks++; if (ev.email) bucket.uniqueClickers.add(ev.email); }
      else if (ev.event_type === "bounce") bucket.bounces++;
    }

    const enriched = rows.map((row) => {
      const bucket = byKey.get(row.subject) || { delivered: 0, opens: 0, clicks: 0, bounces: 0, uniqueOpeners: new Set(), uniqueClickers: new Set() };
      // Prefer event-based delivered count when SendGrid has reported one
      // (the real "did the inbox receive it" metric); fall back to the
      // recipients_count we recorded at send time. Bounces aren't
      // subtracted from delivered — SendGrid emits both events.
      const denom = bucket.delivered > 0 ? bucket.delivered : (row.recipients_count || 0);
      const openRate = denom > 0 ? bucket.uniqueOpeners.size / denom : 0;
      const clickRate = denom > 0 ? bucket.uniqueClickers.size / denom : 0;
      return {
        ...row,
        delivered: bucket.delivered || row.recipients_count || 0,
        opens: bucket.opens,
        uniqueOpens: bucket.uniqueOpeners.size,
        clicks: bucket.clicks,
        uniqueClicks: bucket.uniqueClickers.size,
        bounces: bucket.bounces,
        openRate,
        clickRate,
      };
    });

    return res.status(200).json({ ok: true, rows: enriched });
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
