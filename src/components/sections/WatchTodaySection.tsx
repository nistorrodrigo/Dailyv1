import React from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, X } from "../ui";
import { BRAND } from "../../constants/brand";

export default function WatchTodaySection(): React.ReactElement | null {
  const { sections, watchToday } = useDailyStore(useShallow((s) => ({ sections: s.sections, watchToday: s.watchToday })));
  const setField = useDailyStore((s) => s.setField);

  if (!sections.find((x) => x.key === "watchToday")?.on) return null;

  const update = (index: number, value: string) => {
    const arr = [...watchToday];
    arr[index] = value;
    setField("watchToday", arr);
  };

  const add = () => setField("watchToday", [...watchToday, ""]);

  const remove = (index: number) => {
    if (watchToday.length <= 1) return;
    setField("watchToday", watchToday.filter((_: string, i: number) => i !== index));
  };

  return (
    <Card title="What to Watch Today" color="#e67e22">
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px" }}>
        3-5 bullets of what could move the market today. This is the call-to-action of the daily.
      </p>
      {watchToday.map((item: string, i: number) => (
        <div key={i} className="flex gap-2 mb-2 items-center">
          <span style={{ color: "#e67e22", fontWeight: 700, fontSize: 14 }}>•</span>
          <input
            value={item}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(i, e.target.value)}
            placeholder="e.g. BCRA auction at 11am — $500mn expected"
            className="themed-input flex-1 px-2.5 py-2 rounded-md border border-[var(--border-input)] text-[13px] bg-[var(--bg-input)] text-[var(--text-primary)]"
          />
          {watchToday.length > 1 && <X onClick={() => remove(i)} />}
        </div>
      ))}
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
