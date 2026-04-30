import React, { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, X, DashBtn } from "../ui";
import SortableList from "../ui/SortableList";
import { BRAND } from "../../constants/brand";
import { rc, rb } from "../../utils/ratings";
import { fmtUpside, upsideColor } from "../../utils/prices";
import { toast } from "../../store/useToastStore";
import type { CoverageItem, EquityPick, FIIdea } from "../../types";

const is: React.CSSProperties = { padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border-input)", fontSize: 12, boxSizing: "border-box" };
const ss: React.CSSProperties = { ...is, background: "var(--bg-card)" };

export default function TradeIdeasSection() {
    const { sections, equityPicks, fiIdeas, analysts } = useDailyStore(useShallow((s) => ({ sections: s.sections, equityPicks: s.equityPicks, fiIdeas: s.fiIdeas, analysts: s.analysts })));
        const updateEquityPick = useDailyStore((s) => s.updateEquityPick);
  const addEquityPick = useDailyStore((s) => s.addEquityPick);
  const removeEquityPick = useDailyStore((s) => s.removeEquityPick);
  const updateFIIdea = useDailyStore((s) => s.updateFIIdea);
  const addFIIdea = useDailyStore((s) => s.addFIIdea);
  const removeFIIdea = useDailyStore((s) => s.removeFIIdea);
  const reorderList = useDailyStore((s) => s.reorderList);
  const setField = useDailyStore((s) => s.setField);

  // Lazy migration: equityPicks/fiIdeas only got `id` recently. Old persisted
  // state from Supabase or localStorage may have items without ids — patch
  // them in once on mount so SortableList has stable keys.
  useEffect(() => {
    const eqMissing = equityPicks.some((p) => !p.id);
    const fiMissing = fiIdeas.some((f) => !f.id);
    if (eqMissing) {
      setField("equityPicks", equityPicks.map((p, i) => p.id ? p : { ...p, id: `ep-legacy-${i}-${Math.random().toString(36).slice(2, 6)}` }));
    }
    if (fiMissing) {
      setField("fiIdeas", fiIdeas.map((f, i) => f.id ? f : { ...f, id: `fi-legacy-${i}-${Math.random().toString(36).slice(2, 6)}` }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [bulkPaste, setBulkPaste] = useState("");

  if (!sections.find((x) => x.key === "tradeIdeas")?.on) return null;

  const allTickers = analysts.flatMap((a) => a.coverage.map((c) => c.ticker));
  const uniqueTickers = [...new Set(allTickers)];

  /**
   * Split a free-form blob ("BBAR, VIST\nIRS · CAAP") into clean tickers,
   * dedupe against what's already on the list, and append a row per ticker.
   * Recognises commas, semicolons, whitespace and pipe as delimiters.
   */
  const handleBulkPaste = () => {
    const parts = bulkPaste
      .split(/[\s,;|·]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (!parts.length) return;
    const existing = new Set(equityPicks.map((p) => p.ticker));
    const fresh = [...new Set(parts)].filter((t) => !existing.has(t));
    if (!fresh.length) {
      toast.info("All those tickers are already in the list.");
      return;
    }
    const added: EquityPick[] = fresh.map((t, i) => ({
      id: `ep-bulk-${Date.now()}-${i}`,
      ticker: t,
      reason: "",
    }));
    setField("equityPicks", [...equityPicks, ...added]);
    setBulkPaste("");
    const skipped = parts.length - fresh.length;
    toast.success(`Added ${added.length} ticker${added.length === 1 ? "" : "s"}${skipped ? ` (${skipped} duplicate${skipped === 1 ? "" : "s"} skipped)` : ""}`);
  };

  const findCoverage = (ticker: string): CoverageItem | null => {
    for (const a of analysts) {
      const c = a.coverage.find((x) => x.ticker === ticker);
      if (c) return c;
    }
    return null;
  };

  return (
    <Card title="Trade Ideas" color={BRAND.blue}>
      {/* Equity Picks */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: BRAND.navy, marginBottom: 8, letterSpacing: 0.5 }}>
          Equity Picks
        </div>
        <SortableList
          items={equityPicks as EquityPick[]}
          onReorder={(from, to) => reorderList("equityPicks", from, to)}
          renderItem={(item) => {
            const idx = equityPicks.findIndex((p) => p.id === item.id);
            const p = equityPicks[idx];
            const cov = findCoverage(p.ticker);
            return (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                <select
                  value={p.ticker}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateEquityPick(idx, "ticker", e.target.value)}
                  style={{ ...ss, width: 100 }}
                >
                  <option value="">Ticker</option>
                  {uniqueTickers.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input
                  aria-label={`${p.ticker || "Equity pick"} reason`}
                  value={p.reason}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEquityPick(idx, "reason", e.target.value)}
                  placeholder="Reason / thesis"
                  style={{ ...is, flex: 1 }}
                />
                {cov && (
                  <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                      color: rc(cov.rating), background: rb(cov.rating),
                    }}>
                      {cov.rating}
                    </span>
                    {cov.tp && (
                      <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>TP {cov.tp}</span>
                    )}
                    {cov.tp && cov.last && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: upsideColor(cov.tp, cov.last) }}>
                        {fmtUpside(cov.tp, cov.last)}
                      </span>
                    )}
                  </div>
                )}
                <X onClick={() => removeEquityPick(idx)} />
              </div>
            );
          }}
        />
        <DashBtn onClick={addEquityPick}>+ Add Equity Pick</DashBtn>

        {/* Bulk ticker paste — turns "BBAR, VIST, IRS" into N rows in one shot */}
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <input
            aria-label="Bulk paste tickers"
            value={bulkPaste}
            onChange={(e) => setBulkPaste(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleBulkPaste(); } }}
            placeholder="Paste tickers: BBAR, VIST, IRS, CAAP…"
            style={{ ...is, flex: 1, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
          />
          <button
            onClick={handleBulkPaste}
            disabled={!bulkPaste.trim()}
            style={{
              padding: "6px 12px",
              borderRadius: 4,
              border: "1px solid var(--border-input)",
              background: "transparent",
              color: bulkPaste.trim() ? BRAND.blue : "var(--text-muted)",
              fontSize: 11,
              fontWeight: 700,
              cursor: bulkPaste.trim() ? "pointer" : "default",
              textTransform: "uppercase",
              letterSpacing: 0.4,
            }}
          >
            Bulk Add
          </button>
        </div>
      </div>

      {/* FI Ideas */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: BRAND.navy, marginBottom: 8, letterSpacing: 0.5 }}>
          Fixed Income Ideas
        </div>
        <SortableList
          items={fiIdeas as FIIdea[]}
          onReorder={(from, to) => reorderList("fiIdeas", from, to)}
          renderItem={(item) => {
            const idx = fiIdeas.findIndex((f) => f.id === item.id);
            const fi = fiIdeas[idx];
            return (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
                <input
                  aria-label="Fixed income trade idea"
                  value={fi.idea}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFIIdea(idx, "idea", e.target.value)}
                  placeholder="Instrument / Trade"
                  style={{ ...is, width: 220 }}
                />
                <input
                  aria-label="Fixed income trade reason"
                  value={fi.reason}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFIIdea(idx, "reason", e.target.value)}
                  placeholder="Reason / thesis"
                  style={{ ...is, flex: 1 }}
                />
                <X onClick={() => removeFIIdea(idx)} />
              </div>
            );
          }}
        />
        <DashBtn onClick={addFIIdea}>+ Add FI Idea</DashBtn>
      </div>
    </Card>
  );
}
