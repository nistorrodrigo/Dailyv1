import React from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, X } from "../ui";
import { bueTimeToZones } from "../../utils/dates";
import type { WatchItem } from "../../types";

/**
 * "What to Watch This Week" editor.
 *
 * Each bullet is a `WatchItem`: a free-text description plus an
 * optional date (calendar picker) and an optional Buenos Aires time.
 * When the analyst sets a time, the ET + London equivalents are
 * computed live via `bueTimeToZones` and shown read-only beside the
 * input — the analyst types one time, foreign PMs get all three.
 *
 * Date + time are optional: a generic bullet ("Congress vote
 * expected this week") just leaves them blank and renders as plain
 * text, same as the pre-upgrade behaviour.
 */
export default function WatchTodaySection(): React.ReactElement | null {
  const { sections, watchToday } = useDailyStore(
    useShallow((s) => ({ sections: s.sections, watchToday: s.watchToday })),
  );
  const setField = useDailyStore((s) => s.setField);

  if (!sections.find((x) => x.key === "watchToday")?.on) return null;

  const patch = (index: number, partial: Partial<WatchItem>) => {
    const arr = watchToday.map((it, i) => (i === index ? { ...it, ...partial } : it));
    setField("watchToday", arr);
  };

  const add = () => setField("watchToday", [...watchToday, { text: "" }]);

  const remove = (index: number) => {
    if (watchToday.length <= 1) return;
    setField("watchToday", watchToday.filter((_, i) => i !== index));
  };

  return (
    <Card title="What to Watch This Week" color="#e67e22">
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px" }}>
        3-5 bullets of what could move the market this week. Add a date + Buenos Aires time
        on time-sensitive items — ET and London times fill in automatically.
      </p>
      {watchToday.map((item: WatchItem, i: number) => {
        const zones = bueTimeToZones(item.timeBUE, item.date);
        return (
          <div key={i} className="mb-2.5 p-2 rounded-md border border-[var(--border-light)] bg-[var(--bg-card-alt)]">
            <div className="flex gap-2 items-center">
              <span style={{ color: "#e67e22", fontWeight: 700, fontSize: 14 }}>•</span>
              <input
                value={item.text}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => patch(i, { text: e.target.value })}
                placeholder="e.g. BCRA auction — $500mn expected"
                aria-label={`Watch item ${i + 1} description`}
                className="themed-input flex-1 px-2.5 py-2 rounded-md border border-[var(--border-input)] text-[13px] bg-[var(--bg-input)] text-[var(--text-primary)]"
              />
              {watchToday.length > 1 && <X onClick={() => remove(i)} ariaLabel={`Remove watch item ${i + 1}`} />}
            </div>
            <div className="flex gap-2 items-center mt-1.5 flex-wrap" style={{ paddingLeft: 20 }}>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Date
                <input
                  type="date"
                  value={item.date || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    patch(i, { date: e.target.value || undefined })}
                  aria-label={`Watch item ${i + 1} date`}
                  className="ml-1 themed-input px-2 py-1 rounded border border-[var(--border-input)] text-[12px] bg-[var(--bg-input)] text-[var(--text-primary)] normal-case"
                />
              </label>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                Time (BUE)
                <input
                  type="time"
                  value={item.timeBUE || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    patch(i, { timeBUE: e.target.value || undefined })}
                  aria-label={`Watch item ${i + 1} Buenos Aires time`}
                  className="ml-1 themed-input px-2 py-1 rounded border border-[var(--border-input)] text-[12px] bg-[var(--bg-input)] text-[var(--text-primary)] normal-case"
                />
              </label>
              {/* Live ET / London readout. Only shows once a time is
                  set — bueTimeToZones returns null for a blank time. */}
              {zones && (
                <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                  → ET {zones.et} · London {zones.london}
                </span>
              )}
            </div>
          </div>
        );
      })}
      <button
        onClick={add}
        className="w-full py-2 mt-1 border-2 border-dashed border-[var(--border-input)] rounded-md bg-transparent text-xs font-semibold cursor-pointer"
        style={{ color: "#e67e22" }}
      >
        + Add bullet
      </button>
    </Card>
  );
}
