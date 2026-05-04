import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, Inp } from "../ui";
import { BRAND } from "../../constants/brand";
import { isToday, todayLocal } from "../../utils/dates";

const SHORTCUTS = [
  ["Ctrl+S", "Copy HTML"],
  ["Ctrl+B", "Copy BBG"],
  ["Ctrl+N", "New Daily"],
  ["Ctrl+P", "Toggle Preview"],
  ["Ctrl+Z", "Undo"],
  ["Ctrl+Shift+Z", "Redo"],
  ["Ctrl+D", "Dark Mode"],
];

/** Length above which the headline starts getting clipped in
 *  Outlook/Gmail desktop preview. Keep at most ~70 chars to stay
 *  fully visible. Counter goes amber past this and red past 90. */
const HEADLINE_SOFT_MAX = 70;
const HEADLINE_HARD_MAX = 90;

export default function GeneralSection() {
  const { date, headline, summaryBar } = useDailyStore(useShallow((s) => ({
    date: s.date,
    headline: s.headline,
    summaryBar: s.summaryBar,
  })));
  const setField = useDailyStore((s) => s.setField);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);

  const today = todayLocal();
  const dateMatchesToday = isToday(date);

  return (
    <Card title="General" color={BRAND.navy}>
      <Inp label="Date" value={date} onChange={(v) => setField("date", v)} placeholder="YYYY-MM-DD" />
      {/* Date sanity check — surfaces immediately when the analyst is
          editing yesterday's draft (didn't click "New Daily") or made
          a typo in the date. Two-state chip: green when matches today,
          amber + "Use today" quick-fix button when it doesn't.
          The button only appears when the mismatch is actionable
          (the value is a valid date that's just not today). */}
      <div className="flex items-center gap-2 -mt-1.5 mb-2.5 text-[11px]">
        {dateMatchesToday ? (
          <span style={{ color: "#1a7a3a" }}>✓ Matches today's date</span>
        ) : (
          <>
            <span style={{ color: "#c97a2c" }}>
              ⚠ Date is not today ({today})
            </span>
            <button
              onClick={() => setField("date", today)}
              className="px-1.5 py-0.5 rounded text-[10px] font-bold border bg-transparent cursor-pointer"
              style={{ borderColor: "#c97a2c", color: "#c97a2c" }}
              title="Update the daily's date to today"
            >
              Use today
            </button>
          </>
        )}
      </div>
      {/* Headline / subject hook. Goes into the email Subject in
          place of the boilerplate "Argentina Daily - May 5". For
          institutional foreign investors getting 50+ research
          pieces/day, this is the single biggest open-rate lever
          we have. Keep it specific, opinionated, time-bound. */}
      <Inp
        label="Headline (subject hook)"
        value={headline}
        onChange={(v) => setField("headline", v)}
        placeholder="Bausili's last test before September | The carry trade calendar starts now"
      />
      <div className="flex items-center gap-2 -mt-1.5 mb-2.5 text-[10px] text-[var(--text-muted)]">
        <span>
          Replaces date in subject when set. Aim for &lt;{HEADLINE_SOFT_MAX} chars to render fully in Outlook/Gmail preview.
        </span>
        {headline && (
          <span
            className="ml-auto font-mono"
            style={{
              color:
                headline.length > HEADLINE_HARD_MAX ? "#c0392b"
                : headline.length > HEADLINE_SOFT_MAX ? "#c97a2c"
                : "var(--text-muted)",
            }}
          >
            {headline.length}/{HEADLINE_SOFT_MAX}
          </span>
        )}
      </div>
      <Inp label="Summary Bar" value={summaryBar} onChange={(v) => setField("summaryBar", v)} multi rows={3} placeholder="Top-level summary line..." />
      <div className="flex justify-end">
        <button
          onClick={() => setShowShortcuts(!showShortcuts)}
          className="text-[10px] text-[var(--text-muted)] bg-transparent border-none cursor-pointer hover:text-[var(--text-primary)]"
        >
          {showShortcuts ? "Hide shortcuts" : "Keyboard shortcuts"}
        </button>
      </div>
      {showShortcuts && (
        <div className="mt-2 p-3 rounded-md bg-[var(--bg-card-alt)] border border-[var(--border-light)]">
          <div className="grid grid-cols-2 gap-1">
            {SHORTCUTS.map(([key, desc]) => (
              <div key={key} className="flex items-center gap-2 text-[11px]">
                <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-input)] border border-[var(--border-input)] text-[10px] font-mono text-[var(--text-secondary)]">{key}</kbd>
                <span className="text-[var(--text-muted)]">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
