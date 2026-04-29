import React, { useState, useMemo } from "react";
import useDailyStore from "../../store/useDailyStore";
import { Card, X } from "../ui";
import { BRAND } from "../../constants/brand";
import { rc } from "../../utils/ratings";
import { toast } from "../../store/useToastStore";

const is: React.CSSProperties = { padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border-input)", fontSize: 12, boxSizing: "border-box" };
const ss: React.CSSProperties = { ...is, background: "var(--bg-input)" };

export default function AnalystsTab() {
  const analysts = useDailyStore((s) => s.analysts);
  const [search, setSearch] = useState<string>("");
  const updateListItem = useDailyStore((s) => s.updateListItem);
  const addListItem = useDailyStore((s) => s.addListItem);
  const removeListItem = useDailyStore((s) => s.removeListItem);
  const updateCoverage = useDailyStore((s) => s.updateCoverage);
  const addCoverage = useDailyStore((s) => s.addCoverage);
  const deleteCoverage = useDailyStore((s) => s.deleteCoverage);
  const setField = useDailyStore((s) => s.setField);

  const fetchPrices = async () => {
    const tickers = analysts.flatMap((a) => a.coverage.map((c) => c.ticker)).filter(Boolean);
    if (!tickers.length) return;
    const unique = [...new Set(tickers)];
    try {
      const resp = await fetch(`/api/prices?tickers=${unique.join(",")}`);
      const data = await resp.json();
      const priceMap = data.prices || {};
      if (Object.keys(priceMap).length === 0) throw new Error("No prices returned");
      setField("analysts", analysts.map((a) => ({
        ...a,
        coverage: a.coverage.map((c) =>
          priceMap[c.ticker] ? { ...c, last: `US$${priceMap[c.ticker].toFixed(2)}` } : c
        ),
      })));
      toast.success(`Updated prices for ${Object.keys(priceMap).length}/${unique.length} tickers`);
    } catch (err: unknown) {
      toast.error("Price fetch failed: " + (err instanceof Error ? err.message : String(err)) + " — enter prices manually.");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const processRows = (rows: { analyst: string; ticker: string; rating: string; tp: string }[]) => {
      const grouped: Record<string, { name: string; title: string; coverage: { ticker: string; rating: string; tp: string }[] }> = {};
      rows.forEach((r: { analyst: string; ticker: string; rating: string; tp: string }) => {
        if (!r.analyst || !r.ticker) return;
        if (!grouped[r.analyst]) grouped[r.analyst] = { name: r.analyst, title: "", coverage: [] };
        const tpVal = (!r.tp || r.tp === "-" || r.tp === "0")
          ? ""
          : String(r.tp).startsWith("US$")
            ? r.tp
            : `US$${parseFloat(String(r.tp).replace(/[^0-9.]/g, "")).toFixed(2)}`;
        const rating = r.rating && ["Overweight", "Neutral", "Underweight", "NR", "UR"].includes(r.rating)
          ? r.rating
          : "NR";
        grouped[r.analyst].coverage.push({
          ticker: r.ticker.toUpperCase().trim(),
          rating,
          tp: tpVal === "US$NaN" ? "" : tpVal,
        });
      });
      const newAnalysts = Object.values(grouped).map((a: { name: string; title: string; coverage: { ticker: string; rating: string; tp: string }[] }, i: number) => ({ id: `imp${Date.now()}${i}`, ...a })) as import("../../types").Analyst[];
      if (newAnalysts.length === 0) { toast.error("No valid data found. Check file format."); return; }
      if (window.confirm(`Found ${newAnalysts.length} analyst(s) with ${rows.length} tickers. Replace current database?`)) {
        setField("analysts", newAnalysts);
      } else {
        setField("analysts", [...analysts, ...newAnalysts]);
      }
      toast.success(`Imported ${newAnalysts.length} analyst(s)`);
    };
    if (file.name.match(/\.xlsx?$/i)) {
      // @ts-ignore - dynamic CDN import
      const XLSX = await import(/* @vite-ignore */ "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
      let hIdx = json.findIndex((r: any[]) => r.some((c: any) => String(c || "").toLowerCase().includes("analyst")) && r.some((c: any) => String(c || "").toLowerCase().includes("ticker")));
      if (hIdx === -1) { toast.error("Could not find header row with 'Analyst Name' and 'Ticker'"); return; }
      const hdr = json[hIdx].map((c: any) => String(c || "").toLowerCase().trim());
      const aCol = hdr.findIndex((h: string) => h.includes("analyst"));
      const tCol = hdr.findIndex((h: string) => h.includes("ticker"));
      const rCol = hdr.findIndex((h: string) => h.includes("rating"));
      const pCol = hdr.findIndex((h: string) => h.includes("target") || h.includes("tp") || h.includes("price"));
      const rows = json.slice(hIdx + 1).filter((r: any[]) => r[aCol] && r[tCol]).map((r: any[]) => ({
        analyst: String(r[aCol] || "").trim(),
        ticker: String(r[tCol] || "").trim(),
        rating: String(r[rCol !== -1 ? rCol : 99] || "NR").trim(),
        tp: String(r[pCol !== -1 ? pCol : 99] || "").trim(),
      }));
      processRows(rows);
    } else {
      const reader = new FileReader();
      reader.onload = (ev: ProgressEvent<FileReader>) => {
        const lines = (ev.target?.result as string).split("\n").map((l: string) => l.trim()).filter(Boolean);
        const hdr = lines[0].toLowerCase();
        if (!hdr.includes("analyst") || !hdr.includes("ticker")) {
          toast.error("CSV must have columns: Analyst Name, Ticker, Rating, Target Price");
          return;
        }
        const rows = lines.slice(1).map((l: string) => {
          const c = l.split(",").map((x: string) => x.trim());
          return { analyst: c[0], ticker: c[1] || "", rating: c[2] || "NR", tp: c[3] || "" };
        });
        processRows(rows);
      };
      reader.readAsText(file);
    }
    e.target.value = "";
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: 20 }}>
      <Card title="Research Analyst Database" color={BRAND.navy}>
        <p style={{ fontSize: 12, color: "#666", margin: "0 0 8px", lineHeight: 1.5 }}>
          Manage analysts and their coverage. Rating and TP auto-populate in the Corporate section.
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <label style={{
            padding: "7px 14px", borderRadius: 6, border: `1px solid ${BRAND.teal}`,
            background: "transparent", color: BRAND.teal, fontSize: 11, fontWeight: 700,
            cursor: "pointer", textTransform: "uppercase",
          }}>
            Upload File
            <input type="file" accept=".xlsx,.xls,.csv,.txt" style={{ display: "none" }} onChange={handleFileUpload} />
          </label>
          <button onClick={fetchPrices} style={{
            padding: "7px 14px", borderRadius: 6, border: `1px solid ${BRAND.sky}`,
            background: "transparent", color: BRAND.sky, fontSize: 11, fontWeight: 700,
            cursor: "pointer", textTransform: "uppercase",
          }}>
            Fetch Closing Prices
          </button>
          <span style={{ fontSize: 10, color: "#999", alignSelf: "center" }}>
            Excel (.xlsx) or CSV with: Analyst Name, Ticker, Rating, Target Price
          </span>
        </div>
        <div className="mb-3">
          <input
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            placeholder="Search analyst or ticker..."
            className="themed-input w-full px-2.5 py-2 rounded-md border border-[var(--border-input)] text-sm bg-[var(--bg-input)] text-[var(--text-primary)]"
          />
        </div>
        {analysts.length === 0 && (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13, lineHeight: 1.6, background: "var(--bg-card-alt)", borderRadius: 8, border: "1px dashed var(--border-light)" }}>
            <div style={{ fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>No analysts yet</div>
            Click <strong>Upload File</strong> above to import from Excel/CSV, or use <strong>+ Add Analyst</strong> below.
          </div>
        )}
        {analysts.filter((a) => {
          if (!search) return true;
          const q = search.toLowerCase();
          return a.name.toLowerCase().includes(q) || a.title.toLowerCase().includes(q) || a.coverage.some((c) => c.ticker.toLowerCase().includes(q));
        }).map((a) => (
          <div key={a.id} style={{ padding: 14, background: "var(--bg-card-alt)", borderRadius: 8, marginBottom: 14, border: "1px solid #eee" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 8, flex: 1 }}>
                <input value={a.name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateListItem("analysts", a.id, "name", e.target.value)} placeholder="Name" style={{ ...is, fontWeight: 700, flex: 2 }} />
                <input value={a.title} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateListItem("analysts", a.id, "title", e.target.value)} placeholder="Title" style={{ ...is, flex: 2 }} />
              </div>
              <X onClick={() => removeListItem("analysts", a.id)} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: BRAND.navy, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Coverage Universe</div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: BRAND.blue }}>
                  <th style={{ padding: "5px 8px", fontSize: 10, color: "#fff", textAlign: "left", width: "20%" }}>Ticker</th>
                  <th style={{ padding: "5px 8px", fontSize: 10, color: "#fff", textAlign: "left", width: "22%" }}>Rating</th>
                  <th style={{ padding: "5px 8px", fontSize: 10, color: "#fff", textAlign: "left", width: "18%" }}>TP</th>
                  <th style={{ padding: "5px 8px", fontSize: 10, color: "#fff", textAlign: "left", width: "18%" }}>Last</th>
                  <th style={{ padding: "5px 8px", fontSize: 10, color: "#fff", width: "10%" }}></th>
                </tr>
              </thead>
              <tbody>
                {a.coverage.map((cv: { ticker: string; rating: string; tp: string; last?: string }, ci: number) => (
                  <tr key={ci} style={{ background: ci % 2 === 0 ? "#fff" : "#f8fafc" }}>
                    <td style={{ padding: 3 }}>
                      <input value={cv.ticker} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCoverage(a.id, ci, "ticker", e.target.value.toUpperCase())} style={{ ...is, width: "100%", fontWeight: 700 }} />
                    </td>
                    <td style={{ padding: 3 }}>
                      <select value={cv.rating} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateCoverage(a.id, ci, "rating", e.target.value)} style={{ ...ss, width: "100%", color: rc(cv.rating), fontWeight: 600 }}>
                        <option value="Overweight">Overweight</option>
                        <option value="Neutral">Neutral</option>
                        <option value="Underweight">Underweight</option>
                        <option value="NR">NR (Not Rated)</option>
                        <option value="UR">UR (Under Review)</option>
                      </select>
                    </td>
                    <td style={{ padding: 3 }}>
                      <input value={cv.tp} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCoverage(a.id, ci, "tp", e.target.value)} onBlur={(e: React.FocusEvent<HTMLInputElement>) => { const v = e.target.value.replace(/[^0-9.]/g, ""); if (v) updateCoverage(a.id, ci, "tp", `US$${parseFloat(v).toFixed(2)}`); }} placeholder="US$0.00" style={{ ...is, width: "100%" }} />
                    </td>
                    <td style={{ padding: 3 }}>
                      <input value={cv.last || ""} onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateCoverage(a.id, ci, "last", e.target.value)} onBlur={(e: React.FocusEvent<HTMLInputElement>) => { const v = e.target.value.replace(/[^0-9.]/g, ""); if (v) updateCoverage(a.id, ci, "last", `US$${parseFloat(v).toFixed(2)}`); }} placeholder="US$0.00" style={{ ...is, width: "100%", color: "#666" }} />
                    </td>
                    <td style={{ padding: 3, textAlign: "center" }}>
                      <X onClick={() => deleteCoverage(a.id, ci)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => addCoverage(a.id)} style={{
              marginTop: 6, padding: "5px 14px", border: "1px dashed #d0d5dd",
              borderRadius: 4, background: "transparent", color: BRAND.teal,
              fontWeight: 600, fontSize: 11, cursor: "pointer",
            }}>
              + Add Ticker
            </button>
          </div>
        ))}
        <button onClick={() => addListItem("analysts", { id: `a${Date.now()}`, name: "", title: "", coverage: [] })} style={{
          width: "100%", padding: 10, border: "2px dashed #d0d5dd", borderRadius: 6,
          background: "transparent", color: BRAND.blue, fontWeight: 600, fontSize: 12, cursor: "pointer",
        }}>
          + Add Analyst
        </button>
      </Card>
    </div>
  );
}
