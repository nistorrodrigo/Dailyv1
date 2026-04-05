import useDailyStore from "../../store/useDailyStore";
import { Card, Inp, X, DashBtn } from "../ui";
import { BRAND } from "../../constants/brand";

const is = { padding: "6px 8px", borderRadius: 4, border: "1px solid #d0d5dd", fontSize: 12, boxSizing: "border-box" };
const ss = { ...is, background: "#fff" };

const REPORT_TYPES = ["Macro", "Weekly", "Strategy", "Sector", "Special"];

export default function ResearchSection() {
  const sections = useDailyStore((s) => s.sections);
  const researchReports = useDailyStore((s) => s.researchReports);
  const updateListItem = useDailyStore((s) => s.updateListItem);
  const addListItem = useDailyStore((s) => s.addListItem);
  const removeListItem = useDailyStore((s) => s.removeListItem);

  if (!sections.find((x) => x.key === "research")?.on) return null;

  return (
    <Card title="Research Reports" color={BRAND.blue}>
      {researchReports.map((r) => (
        <div key={r.id} style={{ marginBottom: 16, padding: 12, background: "#f8f9fa", borderRadius: 6, position: "relative" }}>
          <div style={{ position: "absolute", top: 8, right: 8 }}>
            <X onClick={() => removeListItem("researchReports", r.id)} />
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
              Type
            </label>
            <select
              value={r.type}
              onChange={(e) => updateListItem("researchReports", r.id, "type", e.target.value)}
              style={{ ...ss, width: "100%" }}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <Inp label="Title" value={r.title} onChange={(v) => updateListItem("researchReports", r.id, "title", v)} />
          <Inp label="Author" value={r.author} onChange={(v) => updateListItem("researchReports", r.id, "author", v)} />
          <Inp label="Body" value={r.body} onChange={(v) => updateListItem("researchReports", r.id, "body", v)} multi rows={3} />
          <Inp label="Link" value={r.link} onChange={(v) => updateListItem("researchReports", r.id, "link", v)} placeholder="https://..." />
        </div>
      ))}
      <DashBtn onClick={() => addListItem("researchReports", { id: Date.now().toString(), type: "Macro", title: "", author: "", body: "", link: "" })}>
        + Add Research Report
      </DashBtn>
    </Card>
  );
}
