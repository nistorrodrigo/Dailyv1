import { useShallow } from "zustand/react/shallow";
import { useState } from "react";
import useDailyStore from "../../store/useDailyStore";
import { Card } from "../ui";
import { BRAND } from "../../constants/brand";
import { toast } from "../../store/useToastStore";

export default function BcraSection() {
    const { sections, bcraData, bcraHiddenRows } = useDailyStore(useShallow((s) => ({ sections: s.sections, bcraData: s.bcraData, bcraHiddenRows: s.bcraHiddenRows })));
      const setBcraData = useDailyStore((s) => s.setBcraData);
  const toggleBcraRow = useDailyStore((s) => s.toggleBcraRow);
  const [fetching, setFetching] = useState<boolean>(false);

  if (!sections.find((x) => x.key === "bcra")?.on) return null;

  const fetchBcra = async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/bcra");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBcraData(data);
    } catch (e) {
      console.error("BCRA fetch failed:", e);
      toast.error("Failed to fetch BCRA data: " + (e as Error).message);
    } finally {
      setFetching(false);
    }
  };

  const rows: Record<string, string>[] = bcraData && Array.isArray(bcraData) ? bcraData : [];

  return (
    <Card title="BCRA Dashboard" color={BRAND.navy}>
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={fetchBcra}
          disabled={fetching}
          style={{
            padding: "8px 20px", borderRadius: 6, border: "none",
            background: BRAND.navy, color: "var(--bg-card)", fontSize: 12,
            fontWeight: 600, cursor: fetching ? "wait" : "pointer",
          }}
        >
          {fetching ? "Fetching..." : "Fetch BCRA Data"}
        </button>
      </div>

      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "2px solid #d0d5dd", fontSize: 11 }}>Show</th>
                {Object.keys(rows[0]).map((col) => (
                  <th key={col} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "2px solid #d0d5dd", fontSize: 11, whiteSpace: "nowrap" }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row: Record<string, string>, i: number) => {
                const key = row.idVariable || row.descripcion || String(i);
                const hidden = bcraHiddenRows[key];
                return (
                  <tr key={i} style={{ opacity: hidden ? 0.4 : 1 }}>
                    <td style={{ padding: "4px 8px", borderBottom: "1px solid #eee" }}>
                      <input
                        type="checkbox"
                        checked={!hidden}
                        onChange={() => toggleBcraRow(key)}
                        style={{ cursor: "pointer" }}
                      />
                    </td>
                    {Object.values(row).map((val: string, j: number) => (
                      <td key={j} style={{ padding: "4px 8px", borderBottom: "1px solid #eee", whiteSpace: "nowrap" }}>
                        {val}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {bcraData && !Array.isArray(bcraData) && (
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 8 }}>
          Data loaded. Format: {typeof bcraData}
        </div>
      )}

      {!bcraData && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
          No data loaded. Click "Fetch BCRA Data" to populate.
        </div>
      )}
    </Card>
  );
}
