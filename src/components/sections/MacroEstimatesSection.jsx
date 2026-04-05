import useDailyStore from "../../store/useDailyStore";
import { Card, Inp, X, DashBtn } from "../ui";
import { BRAND } from "../../constants/brand";

const is = { padding: "6px 8px", borderRadius: 4, border: "1px solid #d0d5dd", fontSize: 12, boxSizing: "border-box" };

export default function MacroEstimatesSection() {
  const sections = useDailyStore((s) => s.sections);
  const macroSource = useDailyStore((s) => s.macroSource);
  const macroCols = useDailyStore((s) => s.macroCols);
  const macroRows = useDailyStore((s) => s.macroRows);
  const setField = useDailyStore((s) => s.setField);
  const updateMacroRow = useDailyStore((s) => s.updateMacroRow);
  const updateMacroRowValue = useDailyStore((s) => s.updateMacroRowValue);
  const addMacroCol = useDailyStore((s) => s.addMacroCol);
  const removeMacroCol = useDailyStore((s) => s.removeMacroCol);
  const addMacroRow = useDailyStore((s) => s.addMacroRow);
  const removeMacroRow = useDailyStore((s) => s.removeMacroRow);

  if (!sections.find((x) => x.key === "macroEstimates")?.on) return null;

  return (
    <Card title="Macro Estimates" color={BRAND.navy}>
      <Inp label="Source" value={macroSource} onChange={(v) => setField("macroSource", v)} placeholder="e.g. REM (BCRA) Jan-26" />

      <div style={{ overflowX: "auto", marginTop: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "2px solid #d0d5dd", minWidth: 160 }}>
                Metric
              </th>
              {macroCols.map((col) => (
                <th key={col} style={{ textAlign: "center", padding: "6px 8px", borderBottom: "2px solid #d0d5dd", minWidth: 100 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                    {col}
                    <X onClick={() => removeMacroCol(col)} />
                  </div>
                </th>
              ))}
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {macroRows.map((row, i) => (
              <tr key={i}>
                <td style={{ padding: 4 }}>
                  <input
                    value={row.label}
                    onChange={(e) => updateMacroRow(i, "label", e.target.value)}
                    placeholder="Metric name"
                    style={{ ...is, width: "100%" }}
                  />
                </td>
                {macroCols.map((col) => (
                  <td key={col} style={{ padding: 4 }}>
                    <input
                      value={row.vals[col] || ""}
                      onChange={(e) => updateMacroRowValue(i, col, e.target.value)}
                      style={{ ...is, width: "100%", textAlign: "center" }}
                    />
                  </td>
                ))}
                <td style={{ padding: 4 }}>
                  <X onClick={() => removeMacroRow(i)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <div style={{ flex: 1 }}>
          <DashBtn onClick={addMacroRow}>+ Add Row</DashBtn>
        </div>
        <div style={{ flex: 1 }}>
          <DashBtn onClick={addMacroCol}>+ Add Column</DashBtn>
        </div>
      </div>
    </Card>
  );
}
