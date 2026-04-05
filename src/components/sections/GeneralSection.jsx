import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, Inp } from "../ui";
import { BRAND } from "../../constants/brand";

const SHORTCUTS = [
  ["Ctrl+S", "Copy HTML"],
  ["Ctrl+B", "Copy BBG"],
  ["Ctrl+N", "New Daily"],
  ["Ctrl+P", "Toggle Preview"],
  ["Ctrl+Z", "Undo"],
  ["Ctrl+Shift+Z", "Redo"],
  ["Ctrl+D", "Dark Mode"],
];

export default function GeneralSection() {
  const { date, summaryBar } = useDailyStore(useShallow((s) => ({ date: s.date, summaryBar: s.summaryBar })));
  const setField = useDailyStore((s) => s.setField);
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <Card title="General" color={BRAND.navy}>
      <Inp label="Date" value={date} onChange={(v) => setField("date", v)} placeholder="YYYY-MM-DD" />
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
