import React from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, Inp, X, DashBtn } from "../ui";
import { BRAND } from "../../constants/brand";
import type { LatestReport } from "../../types";

// Author input shares the editor's small-control style with the
// rest of the grid (Inp + select inside Corporate use a sibling of
// this shape).
const ss: React.CSSProperties = {
  padding: "6px 8px",
  borderRadius: 4,
  border: "1px solid var(--border-input)",
  fontSize: 12,
  boxSizing: "border-box",
  background: "var(--bg-card)",
};

/**
 * Latest Research Reports — a compact "what we just published" list
 * that points clients at recent LS publications without quoting them
 * in line. Distinct from `ResearchSection` (the full-embed variant
 * with body text dropped into the daily); use this when you just
 * want a digest of links.
 *
 * Each row: type tag, title, analyst (dropdown from the canonical
 * Analysts catalogue), optional published date, link. No body
 * field by design — that's what the full Research Reports section
 * is for. The analyst dropdown matches the same pattern Corporate
 * blocks use so the desk doesn't have to retype names; falls back
 * to a free-text `author` for external contributors.
 */
export default function LatestReportsSection(): React.ReactElement | null {
  const { sections, latestReports, analysts } = useDailyStore(
    useShallow((s) => ({
      sections: s.sections,
      latestReports: s.latestReports,
      analysts: s.analysts,
    })),
  );
  const updateListItem = useDailyStore((s) => s.updateListItem);
  const addListItem = useDailyStore((s) => s.addListItem);
  const removeListItem = useDailyStore((s) => s.removeListItem);

  if (!sections.find((x) => x.key === "latestReports")?.on) return null;

  const newReport: LatestReport = {
    id: `lr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: "",
    title: "",
    author: "",
    analystId: "",
    publishedDate: "",
    link: "",
  };

  return (
    <Card title="Latest Research Reports" color={BRAND.blue}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Compact list of recent LS publications — title + author + link only. Use the
        full Research Reports section above to quote a report's body in line.
      </p>

      {latestReports.length === 0 && (
        <div
          style={{
            padding: "16px",
            textAlign: "center",
            fontSize: 12,
            color: "var(--text-muted)",
            fontStyle: "italic",
            background: "var(--bg-card-alt)",
            borderRadius: 6,
            border: "1px dashed var(--border-light)",
            marginBottom: 10,
          }}
        >
          No reports listed. Add the most recent ones below.
        </div>
      )}

      {latestReports.map((r) => {
        // "External" is a sentinel value for the dropdown that switches
        // the row from "pick a known analyst" to "type a free-text
        // author" (visiting analyst, partner desk, etc.). When the
        // analyst is in the catalogue, the free-text input is hidden
        // and `author` cleared so the resolved name is the single
        // source of truth.
        const useExternal = !r.analystId && (r.author?.trim().length ?? 0) > 0;
        const dropdownValue = r.analystId || (useExternal ? "__external__" : "");
        return (
          <div
            key={r.id}
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr 160px 110px 24px",
              gap: 6,
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <Inp
              label=""
              value={r.type}
              onChange={(v) => updateListItem("latestReports", r.id, "type", v)}
              placeholder="Type (Macro, Banks, …)"
            />
            <Inp
              label=""
              value={r.title}
              onChange={(v) => updateListItem("latestReports", r.id, "title", v)}
              placeholder="Report title"
            />
            <select
              value={dropdownValue}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                const v = e.target.value;
                if (v === "__external__") {
                  // Switch to free-text mode — clear analystId, leave
                  // author for the analyst to fill in below.
                  updateListItem("latestReports", r.id, "analystId", "");
                } else {
                  // Picking a catalogue analyst — clear the free-text
                  // fallback so the resolved name is the only source.
                  updateListItem("latestReports", r.id, "analystId", v);
                  if (r.author) updateListItem("latestReports", r.id, "author", "");
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
            <Inp
              label=""
              value={r.publishedDate || ""}
              onChange={(v) => updateListItem("latestReports", r.id, "publishedDate", v)}
              placeholder="2026-05-04"
            />
            <X onClick={() => removeListItem("latestReports", r.id)} />
            {/* Free-text author — only shown when the analyst opted
                into "External / other…", spans the row beneath. */}
            {dropdownValue === "__external__" && (
              <div style={{ gridColumn: "1 / -1", marginTop: 4, marginLeft: 126 }}>
                <Inp
                  label=""
                  value={r.author}
                  onChange={(v) => updateListItem("latestReports", r.id, "author", v)}
                  placeholder="External author name"
                />
              </div>
            )}
          </div>
        );
      })}

      {latestReports.map((r) => (
        // Link goes on its own row beneath each entry to give it room
        // (URLs blow out a 5-column grid). Hidden when title is empty
        // to avoid clutter when the analyst is only sketching titles.
        r.title?.trim() ? (
          <div key={`${r.id}-link`} style={{ marginBottom: 10, marginLeft: 4 }}>
            <Inp
              label={`↗ Link for "${r.title}"`}
              value={r.link}
              onChange={(v) => updateListItem("latestReports", r.id, "link", v)}
              placeholder="https://research.latinsecurities.ar/…"
            />
          </div>
        ) : null
      ))}

      <DashBtn onClick={() => addListItem("latestReports", newReport)}>
        + Add report
      </DashBtn>
    </Card>
  );
}
