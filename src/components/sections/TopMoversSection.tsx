import React, { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, X, DashBtn } from "../ui";
import { BRAND } from "../../constants/brand";
import { toast } from "../../store/useToastStore";

const is: React.CSSProperties = { padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border-input)", fontSize: 12, boxSizing: "border-box" };

export default function TopMoversSection() {
    const { sections, topMovers, cclRate } = useDailyStore(useShallow((s) => ({ sections: s.sections, topMovers: s.topMovers, cclRate: s.cclRate })));
      const updateMover = useDailyStore((s) => s.updateMover);
  const addMover = useDailyStore((s) => s.addMover);
  const removeMover = useDailyStore((s) => s.removeMover);
  const setField = useDailyStore((s) => s.setField);
  const [fetching, setFetching] = useState<boolean>(false);

  if (!sections.find((x) => x.key === "topMovers")?.on) return null;

  const fetchCCL = async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/ccl");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setField("cclRate", data);
    } catch (e) {
      console.error("CCL fetch failed:", e);
      toast.error("Failed to fetch CCL: " + (e as Error).message);
    } finally {
      setFetching(false);
    }
  };

  const renderSide = (type: "gainers" | "losers", label: string, color: string, bgColor: string) => (
    <div style={{ flex: 1 }}>
      <Card title={label} color={color}>
        {topMovers[type].map((m: { ticker: string; chgPct: string; comment: string }, i: number) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
            <input
              aria-label={`${label} ticker`}
              value={m.ticker}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMover(type, i, "ticker", e.target.value)}
              placeholder="Ticker"
              style={{ ...is, width: 80 }}
            />
            <input
              aria-label={`${label} change percent`}
              value={m.chgPct}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMover(type, i, "chgPct", e.target.value)}
              placeholder="%"
              style={{ ...is, width: 60, textAlign: "center" }}
            />
            <input
              aria-label={`${label} comment`}
              value={m.comment}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateMover(type, i, "comment", e.target.value)}
              placeholder="Comment"
              style={{ ...is, flex: 1 }}
            />
            <X onClick={() => removeMover(type, i)} />
          </div>
        ))}
        <DashBtn onClick={() => addMover(type)} color={color}>+ Add</DashBtn>
      </Card>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <button
          onClick={fetchCCL}
          disabled={fetching}
          style={{
            padding: "6px 16px", borderRadius: 6, border: "none",
            background: BRAND.navy, color: "var(--bg-card)", fontSize: 12,
            fontWeight: 600, cursor: fetching ? "wait" : "pointer",
          }}
        >
          {fetching ? "Fetching..." : "Fetch CCL"}
        </button>
        {cclRate && (
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            CCL: {typeof cclRate === "object" ? JSON.stringify(cclRate) : cclRate}
          </span>
        )}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        {renderSide("gainers", "Gainers", "#27864a", BRAND.greenBg)}
        {renderSide("losers", "Losers", "#c0392b", BRAND.salmonBg)}
      </div>
    </div>
  );
}
