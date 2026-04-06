import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, Inp, X, DashBtn } from "../ui";
import { BRAND } from "../../constants/brand";
import { rc, rb } from "../../utils/ratings";
import { calcUpside, fmtUpside, upsideColor } from "../../utils/prices";

const is = { padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border-input)", fontSize: 12, boxSizing: "border-box" };
const ss = { ...is, background: "var(--bg-card)" };

export default function TradeIdeasSection() {
    const { sections, equityPicks, fiIdeas, analysts } = useDailyStore(useShallow((s) => ({ sections: s.sections, equityPicks: s.equityPicks, fiIdeas: s.fiIdeas, analysts: s.analysts })));
        const updateEquityPick = useDailyStore((s) => s.updateEquityPick);
  const addEquityPick = useDailyStore((s) => s.addEquityPick);
  const removeEquityPick = useDailyStore((s) => s.removeEquityPick);
  const updateFIIdea = useDailyStore((s) => s.updateFIIdea);
  const addFIIdea = useDailyStore((s) => s.addFIIdea);
  const removeFIIdea = useDailyStore((s) => s.removeFIIdea);

  if (!sections.find((x) => x.key === "tradeIdeas")?.on) return null;

  const allTickers = analysts.flatMap((a) => a.coverage.map((c) => c.ticker));
  const uniqueTickers = [...new Set(allTickers)];

  const findCoverage = (ticker) => {
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
        {equityPicks.map((p, i) => {
          const cov = findCoverage(p.ticker);
          return (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
              <select
                value={p.ticker}
                onChange={(e) => updateEquityPick(i, "ticker", e.target.value)}
                style={{ ...ss, width: 100 }}
              >
                <option value="">Ticker</option>
                {uniqueTickers.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                value={p.reason}
                onChange={(e) => updateEquityPick(i, "reason", e.target.value)}
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
              <X onClick={() => removeEquityPick(i)} />
            </div>
          );
        })}
        <DashBtn onClick={addEquityPick}>+ Add Equity Pick</DashBtn>
      </div>

      {/* FI Ideas */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: BRAND.navy, marginBottom: 8, letterSpacing: 0.5 }}>
          Fixed Income Ideas
        </div>
        {fiIdeas.map((fi, i) => (
          <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 8 }}>
            <input
              value={fi.idea}
              onChange={(e) => updateFIIdea(i, "idea", e.target.value)}
              placeholder="Instrument / Trade"
              style={{ ...is, width: 220 }}
            />
            <input
              value={fi.reason}
              onChange={(e) => updateFIIdea(i, "reason", e.target.value)}
              placeholder="Reason / thesis"
              style={{ ...is, flex: 1 }}
            />
            <X onClick={() => removeFIIdea(i)} />
          </div>
        ))}
        <DashBtn onClick={addFIIdea}>+ Add FI Idea</DashBtn>
      </div>
    </Card>
  );
}
