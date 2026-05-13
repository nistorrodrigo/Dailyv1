import React from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, Inp, X, DashBtn, AutofillLinkBtn } from "../ui";
import { BRAND } from "../../constants/brand";

const is: React.CSSProperties = { padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border-input)", fontSize: 12, boxSizing: "border-box" };
const ss: React.CSSProperties = { ...is, background: "var(--bg-card)" };

// Typed `as const` so the union flows through the `<option>` map
// and the typed `updateListItem` cast below — keeps the runtime
// list and the `ResearchReport.type` union in sync (a typo here
// would compile-error instead of slipping into persisted state).
const REPORT_TYPES = ["Macro", "Weekly", "Strategy", "Sector", "Special"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

export default function ResearchSection() {
  const { sections, researchReports, analysts } = useDailyStore(useShallow((s) => ({
    sections: s.sections,
    researchReports: s.researchReports,
    analysts: s.analysts,
  })));
  const updateListItem = useDailyStore((s) => s.updateListItem);
  const addListItem = useDailyStore((s) => s.addListItem);
  const removeListItem = useDailyStore((s) => s.removeListItem);

  if (!sections.find((x) => x.key === "research")?.on) return null;

  return (
    <Card title="Research Reports" color={BRAND.blue}>
      {researchReports.map((r) => {
        // Author dropdown logic mirrors LatestReportsSection: a
        // catalogue analyst id wins, the `__external__` sentinel
        // value (persisted into `analystId`) switches to a
        // free-text fallback for visiting / partner-desk authors,
        // blank shows the placeholder.
        //
        // Why persist the sentinel rather than rederive from
        // `author`: picking "External / other…" before typing any
        // text used to snap the select back to the placeholder
        // (because `useExternal` requires `author.trim().length`).
        // Persisting `__external__` keeps the user's choice across
        // re-renders so the free-text input shows up immediately.
        // Downstream renderers (generateHTML / generateBBG) already
        // handle the sentinel via `analysts.find(a => a.id === ...)`
        // returning undefined and falling through to `r.author`.
        const isExternal =
          r.analystId === "__external__" ||
          (!r.analystId && (r.author?.trim().length ?? 0) > 0);
        const dropdownValue = isExternal ? "__external__" : (r.analystId ?? "");
        return (
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
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateListItem("researchReports", r.id, "type", e.target.value as ReportType)}
              style={{ ...ss, width: "100%" }}
            >
              {REPORT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <Inp label="Title" value={r.title} onChange={(v) => updateListItem("researchReports", r.id, "title", v)} />

          {/* Author — dropdown of catalogue analysts with an
              "External / other…" escape hatch for visiting authors.
              Same pattern Corporate / LatestReports use so the desk
              gets one consistent UX across every author field. */}
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>
              Author
            </label>
            <select
              value={dropdownValue}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                const v = e.target.value;
                if (v === "__external__") {
                  // Persist the sentinel into analystId so the
                  // External-mode input stays visible after the
                  // re-render. See the rationale block above the
                  // map() — this fixes a bug where picking External
                  // and not typing immediately snapped back.
                  updateListItem("researchReports", r.id, "analystId", "__external__");
                } else {
                  updateListItem("researchReports", r.id, "analystId", v);
                  if (r.author) updateListItem("researchReports", r.id, "author", "");
                }
              }}
              style={{ ...ss, width: "100%" }}
            >
              <option value="">Author…</option>
              {analysts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
              <option value="__external__">External / other…</option>
            </select>
            {dropdownValue === "__external__" && (
              <div style={{ marginTop: 6 }}>
                <Inp
                  label=""
                  value={r.author}
                  onChange={(v) => updateListItem("researchReports", r.id, "author", v)}
                  placeholder="External author name"
                />
              </div>
            )}
          </div>

          <Inp label="Body" value={r.body} onChange={(v) => updateListItem("researchReports", r.id, "body", v)} multi rows={3} />
          <Inp label="Link" value={r.link} onChange={(v) => updateListItem("researchReports", r.id, "link", v)} placeholder="https://..." />
          {/* Auto-fill — pulls title / author / description off the
              report's hosting page. Only writes to fields that are
              currently empty so the analyst's own typing wins.
              Author auto-fill only kicks in when the analyst hasn't
              picked a catalogue entry — `analystId` is the source
              of truth there and shouldn't be overwritten by a
              page-level <meta name="author">. */}
          <div style={{ marginTop: -4, marginBottom: 8 }}>
            <AutofillLinkBtn
              url={r.link}
              onFill={(meta) => {
                if (meta.title && !r.title.trim()) {
                  updateListItem("researchReports", r.id, "title", meta.title);
                }
                // Autofill author only when no catalogue analyst is
                // picked. The `__external__` sentinel counts as "no
                // catalogue pick" — the free-text input is the
                // target field in that case.
                const noCataloguePick = !r.analystId || r.analystId === "__external__";
                if (meta.author && noCataloguePick && !r.author.trim()) {
                  updateListItem("researchReports", r.id, "author", meta.author);
                }
                if (meta.description && !r.body.trim()) {
                  updateListItem("researchReports", r.id, "body", meta.description);
                }
              }}
            />
          </div>
        </div>
        );
      })}
      <DashBtn onClick={() => addListItem("researchReports", { id: Date.now().toString(), type: "Macro", title: "", author: "", analystId: "", body: "", link: "" })}>
        + Add Research Report
      </DashBtn>
    </Card>
  );
}
