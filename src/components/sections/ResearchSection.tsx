import React from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, Inp, X, DashBtn, AutofillLinkBtn } from "../ui";
import { BRAND } from "../../constants/brand";

const is: React.CSSProperties = { padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border-input)", fontSize: 12, boxSizing: "border-box" };
const ss: React.CSSProperties = { ...is, background: "var(--bg-card)" };

const REPORT_TYPES = ["Macro", "Weekly", "Strategy", "Sector", "Special"];

export default function ResearchSection() {
    const { sections, researchReports } = useDailyStore(useShallow((s) => ({ sections: s.sections, researchReports: s.researchReports })));
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
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
              Type
            </label>
            <select
              value={r.type}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateListItem("researchReports", r.id, "type", e.target.value)}
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
          {/* Auto-fill — pulls title / author / description off the
              report's hosting page. Only writes to fields that are
              currently empty so the analyst's own typing wins. */}
          <div style={{ marginTop: -4, marginBottom: 8 }}>
            <AutofillLinkBtn
              url={r.link}
              onFill={(meta) => {
                if (meta.title && !r.title.trim()) {
                  updateListItem("researchReports", r.id, "title", meta.title);
                }
                if (meta.author && !r.author.trim()) {
                  updateListItem("researchReports", r.id, "author", meta.author);
                }
                if (meta.description && !r.body.trim()) {
                  updateListItem("researchReports", r.id, "body", meta.description);
                }
              }}
            />
          </div>
        </div>
      ))}
      <DashBtn onClick={() => addListItem("researchReports", { id: Date.now().toString(), type: "Macro", title: "", author: "", body: "", link: "" })}>
        + Add Research Report
      </DashBtn>
    </Card>
  );
}
