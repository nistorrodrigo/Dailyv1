import React from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card } from "../ui";
import { BRAND } from "../../constants/brand";

const is: React.CSSProperties = { padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border-input)", fontSize: 12, boxSizing: "border-box", width: "100%", background: "var(--bg-input)", color: "var(--text-primary)" };

const rows = [
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
] as const;

export default function SnapshotSection(): React.ReactElement | null {
  const { sections, snapshot } = useDailyStore(useShallow((s) => ({ sections: s.sections, snapshot: s.snapshot })));
  const setField = useDailyStore((s) => s.setField);

  if (!sections.find((x) => x.key === "snapshot")?.on) return null;

  const update = (key: string, value: string) => {
    setField("snapshot", { ...snapshot, [key]: value });
  };

  return (
    <Card title="Market Snapshot" color={BRAND.navy}>
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
                  value={(snapshot as Record<string, string>)[r.key] || ""}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(r.key, e.target.value)}
                  style={{ ...is, textAlign: "center" }}
                  placeholder="—"
                />
              </td>
              <td style={{ padding: 3 }}>
                {r.chgKey ? (
                  <input
                    value={(snapshot as Record<string, string>)[r.chgKey] || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => update(r.chgKey, e.target.value)}
                    style={{ ...is, textAlign: "center", color: ((snapshot as Record<string, string>)[r.chgKey] || "").startsWith("-") ? "#c0392b" : "#1a7a3a" }}
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
