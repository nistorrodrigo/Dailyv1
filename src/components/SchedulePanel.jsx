import { useState, useEffect } from "react";
import { BRAND } from "../constants/brand";

export default function SchedulePanel({ open, onClose }) {
  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sgLists, setSgLists] = useState([]);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/schedule").then(r => r.json()).then(data => {
      if (data.ok) setSchedule(data.schedule);
    }).finally(() => setLoading(false));
  }, [open]);

  const loadLists = async () => {
    const resp = await fetch("/api/sendgrid-lists");
    const data = await resp.json();
    if (data.ok) setSgLists(data.lists);
  };

  const handleSave = async () => {
    setSaving(true);
    setResult(null);
    try {
      const resp = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(schedule),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);
      setResult({ type: "success", message: "Schedule saved!" });
    } catch (err) {
      setResult({ type: "error", message: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed top-0 right-0 bottom-0 w-[400px] bg-[var(--bg-card)] shadow-[var(--shadow-panel)] z-[1000] flex flex-col">
      <div className="flex justify-between items-center px-5 py-4" style={{ background: BRAND.navy }}>
        <span className="text-white text-sm font-bold uppercase tracking-wider">Scheduled Send</span>
        <button onClick={onClose} className="bg-transparent border-none text-sky text-xl cursor-pointer">{"\u00D7"}</button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {loading && <p className="text-sm text-[var(--text-muted)] text-center py-4">Loading...</p>}
        {schedule && (
          <>
            {/* Enable toggle */}
            <div className="flex items-center justify-between mb-4 p-3 rounded-md bg-[var(--bg-card-alt)] border border-[var(--border-light)]">
              <div>
                <div className="text-sm font-bold text-[var(--text-primary)]">Auto-send enabled</div>
                <div className="text-[11px] text-[var(--text-muted)]">Send daily automatically at scheduled time</div>
              </div>
              <button
                onClick={() => setSchedule({ ...schedule, enabled: !schedule.enabled })}
                className="relative w-12 h-6 rounded-full cursor-pointer border-none"
                style={{ background: schedule.enabled ? BRAND.blue : "#c8cdd3" }}
              >
                <div className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-[left] duration-200"
                  style={{ left: schedule.enabled ? 26 : 3 }} />
              </button>
            </div>

            {/* Time */}
            <div className="mb-4">
              <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Send Time
              </label>
              <input
                type="time"
                value={schedule.send_time || "07:00"}
                onChange={(e) => setSchedule({ ...schedule, send_time: e.target.value })}
                className="themed-input w-full px-3 py-2 rounded-md border border-[var(--border-input)] text-sm bg-[var(--bg-input)] text-[var(--text-primary)]"
              />
              <div className="text-[10px] text-[var(--text-muted)] mt-1">
                Timezone: Buenos Aires (UTC-3). Cron checks every 15min between 7-9 AM weekdays.
              </div>
            </div>

            {/* SendGrid list */}
            <div className="mb-4">
              <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                SendGrid List
              </label>
              {schedule.sendgrid_list_name && (
                <div className="mb-2 px-3 py-2 rounded-md bg-[var(--bg-card-alt)] border border-[var(--border-light)] text-sm text-[var(--text-primary)] flex items-center justify-between">
                  <span>{schedule.sendgrid_list_name}</span>
                  <button
                    onClick={() => setSchedule({ ...schedule, sendgrid_list_id: null, sendgrid_list_name: null })}
                    className="text-red-500 bg-transparent border-none cursor-pointer text-sm"
                  >{"\u00D7"}</button>
                </div>
              )}
              {sgLists.length === 0 ? (
                <button
                  onClick={loadLists}
                  className="px-3 py-1.5 rounded-md border border-[var(--border-input)] bg-transparent text-[var(--text-secondary)] text-[11px] font-semibold cursor-pointer"
                >
                  Load SendGrid Lists
                </button>
              ) : (
                <div className="flex gap-1.5 flex-wrap">
                  {sgLists.map(list => (
                    <button
                      key={list.id}
                      onClick={() => setSchedule({ ...schedule, sendgrid_list_id: list.id, sendgrid_list_name: list.name })}
                      className={`px-2.5 py-1.5 rounded text-[10px] font-bold border cursor-pointer ${
                        schedule.sendgrid_list_id === list.id
                          ? "border-blue-500 text-blue-500 bg-blue-50"
                          : "border-[var(--border-input)] text-[var(--text-primary)] bg-transparent"
                      }`}
                    >
                      {list.name} ({list.count})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Last sent info */}
            {schedule.last_sent_at && (
              <div className="mb-4 p-3 rounded-md bg-[var(--bg-card-alt)] border border-[var(--border-light)]">
                <div className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1">Last Sent</div>
                <div className="text-sm text-[var(--text-primary)]">
                  {new Date(schedule.last_sent_at).toLocaleString()} ({schedule.last_sent_date})
                </div>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className={`mb-3 p-3 rounded-md text-sm font-semibold ${result.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
                {result.message}
              </div>
            )}
          </>
        )}
      </div>

      {/* Save button */}
      <div className="p-4 border-t border-[var(--border-light)]">
        <button
          onClick={handleSave}
          disabled={saving || !schedule}
          className="w-full py-3 rounded-md border-none text-white text-sm font-bold cursor-pointer uppercase disabled:opacity-50"
          style={{ background: saving ? "#999" : BRAND.blue }}
        >
          {saving ? "Saving..." : "Save Schedule"}
        </button>
      </div>
    </div>
  );
}
