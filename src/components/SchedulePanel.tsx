import React, { useState, useEffect } from "react";
import { BRAND } from "../constants/brand";
import { fetchSendGridLists, type SendGridList } from "../lib/sendgridApi";
import { authedFetch } from "../lib/authedFetch";
import { todayLocal, fmtRelativeTime } from "../utils/dates";
import { displayNameFromEmail } from "../utils/displayName";

interface SchedulePanelProps {
  open: boolean;
  onClose: () => void;
}

interface ScheduleObject {
  enabled: boolean;
  scheduled_date: string;
  send_time: string;
  sendgrid_list_id: string | null;
  sendgrid_list_name: string | null;
  recipient_emails?: string[];
  last_sent_at?: string;
  last_sent_date?: string;
}

/** Subset of email_log we render in the "already sent" banner. */
interface SentLogRow {
  id: string;
  daily_date: string;
  recipients_count: number;
  list_name?: string | null;
  is_test: boolean;
  sent_at: string;
  sent_by?: string | null;
}

interface ResultMessage {
  type: "success" | "error";
  message: string;
}

export default function SchedulePanel({ open, onClose }: SchedulePanelProps): React.ReactElement | null {
  const [schedule, setSchedule] = useState<ScheduleObject | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [sgLists, setSgLists] = useState<SendGridList[]>([]);
  const [result, setResult] = useState<ResultMessage | null>(null);
  // Most recent NON-test send for the currently-selected scheduled
  // date. Used to render the "already sent" banner so the analyst
  // doesn't accidentally schedule a duplicate blast for a day that
  // already shipped.
  const [alreadySent, setAlreadySent] = useState<SentLogRow | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setResult(null);
    (async () => {
      try {
        const resp = await authedFetch("/api/schedule");
        const data = await resp.json();
        if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
        const s = data.schedule;
        // If last scheduled date already passed, reset to today's
        // local date (NOT toISOString — that's UTC and can roll over
        // a day for analysts editing late at night).
        const today = todayLocal();
        if (s.scheduled_date && s.scheduled_date < today) {
          s.enabled = false;
          s.scheduled_date = today;
        }
        if (!s.scheduled_date) s.scheduled_date = today;
        setSchedule(s);
      } catch (err) {
        setResult({ type: "error", message: "Failed to load schedule: " + (err as Error).message });
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  // Whenever the selected scheduled_date changes (or the panel opens),
  // check whether email_log has a non-test send for that date already.
  // The banner that renders below uses this to nudge the analyst
  // before they schedule a duplicate blast. Cheap query — narrow
  // filter, max 10 rows, just one DB hit.
  useEffect(() => {
    if (!open || !schedule?.scheduled_date) return;
    let cancelled = false;
    (async () => {
      try {
        const resp = await authedFetch(
          `/api/analytics?type=email-log&date=${encodeURIComponent(schedule.scheduled_date)}`,
        );
        const data = await resp.json();
        if (cancelled) return;
        if (!resp.ok || !data.ok) {
          // Non-fatal — just don't render the banner.
          setAlreadySent(null);
          return;
        }
        const logs = (data.logs as SentLogRow[] | undefined) || [];
        const realSend = logs.find((l) => !l.is_test && l.daily_date === schedule.scheduled_date) || null;
        setAlreadySent(realSend);
      } catch {
        if (!cancelled) setAlreadySent(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, schedule?.scheduled_date]);

  const loadLists = async (): Promise<void> => {
    try {
      const lists = await fetchSendGridLists();
      setSgLists(lists);
    } catch (err) {
      setResult({ type: "error", message: "Failed to load SendGrid lists: " + (err as Error).message });
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!schedule?.sendgrid_list_id && !(schedule?.recipient_emails?.length)) {
      setResult({ type: "error", message: "Select a SendGrid list first" });
      return;
    }
    setSaving(true);
    setResult(null);
    try {
      const resp = await authedFetch("/api/schedule", {
        method: "POST",
        body: JSON.stringify({ ...schedule, enabled: true }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);
      setSchedule({ ...schedule!, enabled: true });
      setResult({ type: "success", message: "Scheduled! Email will be sent on " + schedule!.scheduled_date + " at " + schedule!.send_time + " BUE" });
    } catch (err) {
      setResult({ type: "error", message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (): Promise<void> => {
    setSaving(true);
    try {
      const resp = await authedFetch("/api/schedule", {
        method: "POST",
        body: JSON.stringify({ ...schedule, enabled: false }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      setSchedule({ ...schedule!, enabled: false });
      setResult({ type: "success", message: "Scheduled send cancelled" });
    } catch (err) {
      setResult({ type: "error", message: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const today = todayLocal();

  return (
    <div className="fixed top-0 right-0 bottom-0 w-[400px] bg-[var(--bg-card)] shadow-[var(--shadow-panel)] z-[1000] flex flex-col panel-slide">
      <div className="flex justify-between items-center px-5 py-4" style={{ background: BRAND.navy }}>
        <span className="text-white text-sm font-bold uppercase tracking-wider">Schedule Send</span>
        <button onClick={onClose} className="bg-transparent border-none text-[var(--color-sky)] text-xl cursor-pointer">{"\u00D7"}</button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {loading && <p className="text-sm text-[var(--text-muted)] text-center py-4">Loading...</p>}
        {schedule && (
          <>
            {/* Already-sent warning. Renders when the email_log already
                has a non-test send for the scheduled_date — same nudge
                pattern as the EmailSendPanel "today already sent"
                banner. Doesn't block scheduling (re-sends are
                legitimate, e.g. a corrected blast), just makes sure
                the analyst knows what they're about to duplicate. */}
            {alreadySent && (
              <div
                className="mb-4 p-3 rounded-md text-[12px]"
                style={{
                  background: "rgba(231,158,76,0.12)",
                  color: "#c97a2c",
                  border: "1px solid rgba(231,158,76,0.45)",
                }}
              >
                <div className="font-bold mb-1">⚠ Daily for {alreadySent.daily_date} already sent</div>
                <div className="text-[11px]" style={{ color: "var(--text-primary)" }}>
                  {fmtRelativeTime(alreadySent.sent_at)}
                  {alreadySent.sent_by ? <> by <strong>{displayNameFromEmail(alreadySent.sent_by)}</strong></> : null}
                  {" "}to <strong>{alreadySent.recipients_count.toLocaleString()}</strong> recipient{alreadySent.recipients_count === 1 ? "" : "s"}
                  {alreadySent.list_name ? <> ({alreadySent.list_name})</> : null}.
                  {" "}Scheduling another blast for the same date will be a duplicate.
                </div>
              </div>
            )}

            {/* Status */}
            {schedule.enabled && (
              <div className="mb-4 p-3 rounded-md border border-green-300 bg-green-50">
                <div className="text-sm font-bold text-green-700">Scheduled</div>
                <div className="text-xs text-green-600 mt-1">
                  Will send on {schedule.scheduled_date} at {schedule.send_time} BUE
                  {schedule.sendgrid_list_name ? " to " + schedule.sendgrid_list_name : ""}
                </div>
                <button
                  onClick={handleCancel}
                  disabled={saving}
                  className="mt-2 px-3 py-1.5 rounded text-xs font-bold border border-red-300 bg-transparent text-red-500 cursor-pointer"
                >
                  Cancel Scheduled Send
                </button>
              </div>
            )}

            {/* Date */}
            <div className="mb-4">
              <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Send Date
              </label>
              <input
                type="date"
                value={schedule.scheduled_date || today}
                min={today}
                onChange={(e) => setSchedule({ ...schedule, scheduled_date: e.target.value })}
                className="themed-input w-full px-3 py-2 rounded-md border border-[var(--border-input)] text-sm bg-[var(--bg-input)] text-[var(--text-primary)]"
              />
              <div className="text-[10px] text-[var(--text-muted)] mt-1">
                One-time send. After sending, the schedule is automatically disabled.
              </div>
            </div>

            {/* Time */}
            <div className="mb-4">
              <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Send Time (Buenos Aires)
              </label>
              <input
                type="time"
                value={schedule.send_time || "07:00"}
                onChange={(e) => setSchedule({ ...schedule, send_time: e.target.value })}
                className="themed-input w-full px-3 py-2 rounded-md border border-[var(--border-input)] text-sm bg-[var(--bg-input)] text-[var(--text-primary)]"
              />
            </div>

            {/* SendGrid list */}
            <div className="mb-4">
              <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
                Send To (SendGrid List)
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
              {!schedule.sendgrid_list_name && sgLists.length === 0 && (
                <button
                  onClick={loadLists}
                  className="px-3 py-1.5 rounded-md border border-[var(--border-input)] bg-transparent text-[var(--text-secondary)] text-[11px] font-semibold cursor-pointer"
                >
                  Load SendGrid Lists
                </button>
              )}
              {sgLists.length > 0 && !schedule.sendgrid_list_name && (
                <div className="flex gap-1.5 flex-wrap">
                  {sgLists.map(list => (
                    <button
                      key={list.id}
                      onClick={() => setSchedule({ ...schedule, sendgrid_list_id: list.id, sendgrid_list_name: list.name })}
                      className="px-2.5 py-1.5 rounded text-[10px] font-bold border border-[var(--border-input)] bg-transparent text-[var(--text-primary)] cursor-pointer hover:bg-[var(--bg-hover)]"
                    >
                      {list.name} ({list.count})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Last sent */}
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

      {/* Schedule button */}
      {schedule && !schedule.enabled && (
        <div className="p-4 border-t border-[var(--border-light)]">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-md border-none text-white text-sm font-bold cursor-pointer uppercase disabled:opacity-50"
            style={{ background: saving ? "#999" : BRAND.blue }}
          >
            {saving ? "Saving..." : "Schedule One-Time Send"}
          </button>
        </div>
      )}
    </div>
  );
}
