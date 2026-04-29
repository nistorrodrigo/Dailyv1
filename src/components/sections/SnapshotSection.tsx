import React, { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card } from "../ui";
import { BRAND } from "../../constants/brand";
import type { MarketSnapshot } from "../../types";
import { toast } from "../../store/useToastStore";

const is: React.CSSProperties = { padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border-input)", fontSize: 12, boxSizing: "border-box", width: "100%", background: "var(--bg-input)", color: "var(--text-primary)" };

type SnapshotKey = keyof MarketSnapshot;
const rows: { key: SnapshotKey; label: string; chgKey: SnapshotKey | null }[] = [
  { key: "merval", label: "Merval", chgKey: "mervalChg" },
  { key: "adrs", label: "ADRs Index", chgKey: "adrsChg" },
  { key: "sp500", label: "S&P 500", chgKey: "sp500Chg" },
  { key: "ust10y", label: "UST 10Y", chgKey: null },
  { key: "dxy", label: "DXY", chgKey: null },
  { key: "soja", label: "Soja", chgKey: null },
  { key: "wti", label: "WTI", chgKey: null },
  { key: "ccl", label: "CCL", chgKey: "cclChg" },
  { key: "mep", label: "MEP", chgKey: "mepChg" },
  { key: "blue", label: "Blue", chgKey: null },
];

export default function SnapshotSection(): React.ReactElement | null {
  const { sections, snapshot } = useDailyStore(useShallow((s) => ({ sections: s.sections, snapshot: s.snapshot })));
  const setField = useDailyStore((s) => s.setField);

  const [fetching, setFetching] = useState(false);

  if (!sections.find((x) => x.key === "snapshot")?.on) return null;

  const update = (key: SnapshotKey, value: string) => {
    setField("snapshot", { ...snapshot, [key]: value });
  };

  const fetchSnapshot = async () => {
    setFetching(true);
    try {
      const resp = await fetch("/api/snapshot");
      const data = await resp.json();
      if (!data.ok) throw new Error("Fetch failed");
      const s: Record<string, { value: string; chg?: string }> = data.snapshot;
      const newSnap: MarketSnapshot = { ...snapshot };
      const map: Record<string, [SnapshotKey, SnapshotKey | null]> = {
        merval: ["merval", "mervalChg"], sp500: ["sp500", "sp500Chg"],
        dxy: ["dxy", null], wti: ["wti", null], soja: ["soja", null],
        ust10y: ["ust10y", null],
        ccl: ["ccl", "cclChg"], mep: ["mep", "mepChg"], blue: ["blue", null],
      };
      for (const [apiKey, [stateKey, chgKey]] of Object.entries(map)) {
        if (s[apiKey]) {
          newSnap[stateKey] = s[apiKey].value;
          if (chgKey && s[apiKey].chg) newSnap[chgKey] = s[apiKey].chg!;
        }
      }
      setField("snapshot", newSnap);
      toast.success(`Updated ${Object.keys(s).length} prices`);
    } catch (err) {
      toast.error("Fetch failed: " + (err as Error).message);
    } finally {
      setFetching(false);
    }
  };

  return (
    <Card title="Market Snapshot" color={BRAND.navy}>
      <div className="flex justify-end mb-3">
        <button
          onClick={fetchSnapshot}
          disabled={fetching}
          className="px-3 py-1.5 rounded-md border text-xs font-bold cursor-pointer disabled:opacity-50"
          style={{ borderColor: BRAND.sky, color: BRAND.sky, background: "transparent" }}
        >
          {fetching ? "Fetching..." : "Auto-Fetch Prices"}
        </button>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--bg-card-alt)" }}>
            <th style={{ padding: "6px 8px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textAlign: "left", textTransform: "uppercase", letterSpacing: 1 }}>Index</th>
            <th style={{ padding: "6px 8px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textAlign: "center", textTransform: "uppercase", letterSpacing: 1 }}>Level</th>
            <th style={{ padding: "6px 8px", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textAlign: "center", textTransform: "uppercase", letterSpacing: 1 }}>Chg %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} style={{ borderBottom: "1px solid var(--border-light)" }}>
              <td style={{ padding: "4px 8px", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{r.label}</td>
              <td style={{ padding: 3 }}>
                <input
                  value={snapshot[r.key] || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(r.key, e.target.value)}
                  style={{ ...is, textAlign: "center" }}
                  placeholder="—"
                />
              </td>
              <td style={{ padding: 3 }}>
                {r.chgKey ? (
                  <input
                    value={snapshot[r.chgKey] || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => r.chgKey && update(r.chgKey, e.target.value)}
                    style={{ ...is, textAlign: "center", color: (snapshot[r.chgKey] || "").startsWith("-") ? "#c0392b" : "#1a7a3a" }}
                    placeholder="—"
                  />
                ) : <span style={{ display: "block", textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
