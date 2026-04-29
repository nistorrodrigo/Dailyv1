import React from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, Inp, X, DashBtn, NewsLinksEditor } from "../ui";
import SortableList from "../ui/SortableList";
import { BRAND } from "../../constants/brand";
import { ImproveBtn, CopyPromptBtn } from "../ui/AIHelpers";
import { rc, rb } from "../../utils/ratings";
import { makeUrlPasteHandler } from "../../hooks/useUrlPasteHint";

const is: React.CSSProperties = { padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border-input)", fontSize: 12, boxSizing: "border-box" };
const ss: React.CSSProperties = { ...is, background: "var(--bg-card)" };

export default function CorporateSection() {
    const { sections, corpBlocks, analysts } = useDailyStore(useShallow((s) => ({ sections: s.sections, corpBlocks: s.corpBlocks, analysts: s.analysts })));
      const updateListItem = useDailyStore((s) => s.updateListItem);
  const addListItem = useDailyStore((s) => s.addListItem);
  const removeListItem = useDailyStore((s) => s.removeListItem);
  const reorderList = useDailyStore((s) => s.reorderList);

  if (!sections.find((x) => x.key === "corporate")?.on) return null;

  const allTickers = analysts.flatMap((a) => a.coverage.map((c) => c.ticker));
  const uniqueTickers = [...new Set(allTickers)];

  return (
    <Card title="Corporate" color={BRAND.blue}>
      <SortableList
        items={corpBlocks}
        onReorder={(from, to) => reorderList("corpBlocks", from, to)}
        renderItem={(item) => {
          const b = corpBlocks.find((x) => x.id === item.id)!;
          const analyst = analysts.find((a) => a.id === b.analystId);
          const tickers = b.tickers || [];

          return (
          <div style={{ marginBottom: 16, padding: 12, background: "#f8f9fa", borderRadius: 6, position: "relative" }}>
            <div style={{ position: "absolute", top: 8, right: 8 }}>
              <X onClick={() => removeListItem("corpBlocks", b.id)} />
            </div>

            {/* Analyst selector */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                Analyst
              </label>
              <select
                value={b.analystId || ""}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateListItem("corpBlocks", b.id, "analystId", e.target.value)}
                style={{ ...ss, width: "100%" }}
              >
                <option value="">Select analyst</option>
                {analysts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} - {a.title}</option>
                ))}
              </select>
            </div>

            {/* Ticker multi-select */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                Tickers
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {uniqueTickers.map((t) => {
                  const active = tickers.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => {
                        const next = active ? tickers.filter((x) => x !== t) : [...tickers, t];
                        updateListItem("corpBlocks", b.id, "tickers", next);
                      }}
                      style={{
                        padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                        border: active ? `1px solid ${BRAND.blue}` : "1px solid #d0d5dd",
                        background: active ? BRAND.lightBg : "var(--bg-card)",
                        color: active ? BRAND.blue : "var(--text-secondary)",
                        cursor: "pointer",
                      }}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Coverage display */}
            {tickers.length > 0 && analyst && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                {tickers.map((t) => {
                  const cov = analyst.coverage.find((c) => c.ticker === t);
                  if (!cov) return null;
                  return (
                    <div key={t} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                      <span style={{ fontWeight: 700 }}>{t}</span>
                      <span style={{
                        padding: "1px 6px", borderRadius: 8,
                        color: rc(cov.rating), background: rb(cov.rating),
                        fontWeight: 600, fontSize: 10,
                      }}>
                        {cov.rating}
                      </span>
                      {cov.tp && <span style={{ color: "#888" }}>TP {cov.tp}</span>}
                    </div>
                  );
                })}
              </div>
            )}

            <Inp label="Headline" value={b.headline} onChange={(v) => updateListItem("corpBlocks", b.id, "headline", v)} />
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Body</label>
              <div className="flex gap-1.5">
                <ImproveBtn text={b.body} onImprove={(v) => updateListItem("corpBlocks", b.id, "body", v)} context={`corporate block: ${(b.tickers || []).join("/")} ${b.headline}`} />
                <CopyPromptBtn section="Corporate" currentText={b.body} />
              </div>
            </div>
            <Inp
              value={b.body}
              onChange={(v) => updateListItem("corpBlocks", b.id, "body", v)}
              multi
              rows={4}
              onPaste={makeUrlPasteHandler(b.newsLinks, (next) => updateListItem("corpBlocks", b.id, "newsLinks", next))}
            />
            <Inp label="LS Report Link" value={b.link} onChange={(v) => updateListItem("corpBlocks", b.id, "link", v)} placeholder="https://..." />
            <NewsLinksEditor
              links={b.newsLinks}
              onChange={(next) => updateListItem("corpBlocks", b.id, "newsLinks", next)}
            />
          </div>
          );
        }}
      />
      <DashBtn onClick={() => addListItem("corpBlocks", { id: Date.now().toString(), tickers: [], headline: "", analystId: "", body: "", link: "" })}>
        + Add Corporate Block
      </DashBtn>
    </Card>
  );
}
