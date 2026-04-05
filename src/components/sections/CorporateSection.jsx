import useDailyStore from "../../store/useDailyStore";
import { Card, Inp, X, DashBtn } from "../ui";
import { BRAND } from "../../constants/brand";
import { rc, rb } from "../../utils/ratings";

const is = { padding: "6px 8px", borderRadius: 4, border: "1px solid #d0d5dd", fontSize: 12, boxSizing: "border-box" };
const ss = { ...is, background: "#fff" };

export default function CorporateSection() {
  const sections = useDailyStore((s) => s.sections);
  const corpBlocks = useDailyStore((s) => s.corpBlocks);
  const analysts = useDailyStore((s) => s.analysts);
  const updateListItem = useDailyStore((s) => s.updateListItem);
  const addListItem = useDailyStore((s) => s.addListItem);
  const removeListItem = useDailyStore((s) => s.removeListItem);

  if (!sections.find((x) => x.key === "corporate")?.on) return null;

  const allTickers = analysts.flatMap((a) => a.coverage.map((c) => c.ticker));
  const uniqueTickers = [...new Set(allTickers)];

  return (
    <Card title="Corporate" color={BRAND.blue}>
      {corpBlocks.map((b) => {
        const analyst = analysts.find((a) => a.id === b.analystId);
        const tickers = b.tickers || [];

        return (
          <div key={b.id} style={{ marginBottom: 16, padding: 12, background: "#f8f9fa", borderRadius: 6, position: "relative" }}>
            <div style={{ position: "absolute", top: 8, right: 8 }}>
              <X onClick={() => removeListItem("corpBlocks", b.id)} />
            </div>

            {/* Analyst selector */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
                Analyst
              </label>
              <select
                value={b.analystId || ""}
                onChange={(e) => updateListItem("corpBlocks", b.id, "analystId", e.target.value)}
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
              <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
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
                        background: active ? BRAND.lightBg : "#fff",
                        color: active ? BRAND.blue : "#666",
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
            <Inp label="Body" value={b.body} onChange={(v) => updateListItem("corpBlocks", b.id, "body", v)} multi rows={4} />
            <Inp label="Link" value={b.link} onChange={(v) => updateListItem("corpBlocks", b.id, "link", v)} placeholder="https://..." />
          </div>
        );
      })}
      <DashBtn onClick={() => addListItem("corpBlocks", { id: Date.now().toString(), tickers: [], headline: "", analystId: "", body: "", link: "" })}>
        + Add Corporate Block
      </DashBtn>
    </Card>
  );
}
