import { useState, useEffect } from "react";
import { BRAND } from "../../constants/brand";

const StatCard = ({ label, value, color = BRAND.navy }: { label: string; value: string | number; color?: string }) => (
  <div className="p-4 rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] flex-1 min-w-[120px]">
    <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-1">{label}</div>
    <div className="text-2xl font-light" style={{ color }}>{value}</div>
  </div>
);

interface AnalyticsData {
  ok: boolean;
  stats: { totalDailies: number; totalEmails: number; emailsMonth: number; testsMonth: number; totalRecipients: number };
  last7: { date: string; count: number }[];
  recentEmails: { id: string; daily_date: string; subject: string; recipients_count: number; is_test: boolean; list_name?: string; sent_at: string }[];
}

export default function DashboardTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetch("/api/analytics").then((r: Response) => r.json()).then((d: AnalyticsData) => {
      if (d.ok) setData(d);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-20 text-[var(--text-muted)]">Loading analytics...</div>;
  if (!data) return <div className="text-center py-20 text-[var(--text-muted)]">Analytics unavailable</div>;

  const { stats, last7, recentEmails } = data;
  const maxCount = Math.max(...last7.map(d => d.count), 1);

  return (
    <div className="max-w-[900px] mx-auto p-5">
      {/* Stats */}
      <div className="flex gap-3 flex-wrap mb-6">
        <StatCard label="Total Dailies" value={stats.totalDailies} />
        <StatCard label="Emails Sent" value={stats.totalEmails} color={BRAND.blue} />
        <StatCard label="This Month" value={stats.emailsMonth} color={BRAND.teal} />
        <StatCard label="Tests" value={stats.testsMonth} color={BRAND.orange} />
        <StatCard label="Total Recipients" value={stats.totalRecipients.toLocaleString()} color={BRAND.green} />
      </div>

      {/* Chart — emails per day */}
      <div className="p-4 rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] mb-6">
        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Emails — Last 7 Days</div>
        <div className="flex items-end gap-2 h-24">
          {last7.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="text-[10px] font-bold text-[var(--text-primary)]">{d.count || ""}</div>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${Math.max((d.count / maxCount) * 80, 2)}px`,
                  background: d.count > 0 ? BRAND.blue : "var(--border-light)",
                }}
              />
              <div className="text-[9px] text-[var(--text-muted)]">{d.date}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent emails */}
      <div className="p-4 rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)]">
        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">Recent Emails</div>
        {recentEmails.length === 0 && <p className="text-sm text-[var(--text-muted)]">No emails sent yet</p>}
        {recentEmails.map((log) => (
          <div key={log.id} className="flex items-center gap-3 py-2 border-b border-[var(--border-light)] last:border-0">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${log.is_test ? "bg-amber-400" : "bg-green-500"}`} />
            <span className="text-sm font-semibold text-[var(--text-primary)] min-w-[80px]">{log.daily_date}</span>
            <span className="text-xs text-[var(--text-secondary)] flex-1 truncate">{log.subject}</span>
            <span className="text-xs text-[var(--text-muted)]">{log.recipients_count} rcpts</span>
            {log.list_name && <span className="text-[10px] text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-[var(--bg-card-alt)] border border-[var(--border-light)]">{log.list_name}</span>}
            <span className="text-[10px] text-[var(--text-muted)]">{new Date(log.sent_at).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
      {/* Email Tracking */}
      <EmailTracking />
    </div>
  );
}

function EmailTracking(): React.ReactElement {
  const [tracking, setTracking] = useState<{
    stats: { totalOpens: number; uniqueOpens: number; totalClicks: number; totalDelivered: number; totalBounces: number };
    topOpeners: { email: string; count: number }[];
    recent: { id: string; event_type: string; email: string; subject: string; timestamp: string; url: string | null }[];
  } | null>(null);
  const [show, setShow] = useState(false);

  const loadTracking = async () => {
    const resp = await fetch("/api/analytics?type=email-events");
    const d = await resp.json();
    if (d.ok) setTracking(d);
    setShow(true);
  };

  return (
    <div className="p-4 rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] mt-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Email Open Tracking</div>
        <button onClick={loadTracking} className="text-[10px] font-semibold text-[var(--color-sky)] bg-transparent border-none cursor-pointer">
          {show ? "Refresh" : "Load Tracking Data"}
        </button>
      </div>
      {!show && <p className="text-xs text-[var(--text-muted)]">Click "Load Tracking Data" to see who opened your dailies.</p>}
      {show && !tracking && <p className="text-xs text-[var(--text-muted)]">No tracking data yet. Data appears after SendGrid webhook is configured.</p>}
      {show && tracking && (
        <>
          <div className="flex gap-3 flex-wrap mb-4">
            <StatCard label="Delivered" value={tracking.stats.totalDelivered} color={BRAND.blue} />
            <StatCard label="Opens" value={tracking.stats.totalOpens} color="#1a7a3a" />
            <StatCard label="Unique Opens" value={tracking.stats.uniqueOpens} color={BRAND.teal} />
            <StatCard label="Clicks" value={tracking.stats.totalClicks} color={BRAND.orange} />
            <StatCard label="Bounces" value={tracking.stats.totalBounces} color="#c0392b" />
          </div>

          {tracking.topOpeners.length > 0 && (
            <div className="mb-4">
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Top Readers</div>
              {tracking.topOpeners.map((o, i) => (
                <div key={i} className="flex items-center gap-2 py-1 text-xs">
                  <span className="w-5 h-5 rounded-full bg-[var(--color-sky)] flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0">{i + 1}</span>
                  <span className="text-[var(--text-primary)] flex-1 truncate">{o.email}</span>
                  <span className="text-[var(--text-muted)]">{o.count} opens</span>
                </div>
              ))}
            </div>
          )}

          {tracking.recent.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Recent Activity</div>
              <div className="max-h-48 overflow-auto">
                {tracking.recent.map((e) => (
                  <div key={e.id} className="flex items-center gap-2 py-1.5 border-b border-[var(--border-light)] text-[11px]">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                      e.event_type === "open" ? "bg-green-100 text-green-700" :
                      e.event_type === "click" ? "bg-blue-100 text-blue-700" :
                      e.event_type === "delivered" ? "bg-gray-100 text-gray-600" :
                      "bg-red-100 text-red-600"
                    }`}>{e.event_type}</span>
                    <span className="text-[var(--text-primary)] flex-1 truncate">{e.email}</span>
                    <span className="text-[var(--text-muted)]">{new Date(e.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
