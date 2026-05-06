import React from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, Inp, X, DashBtn } from "../ui";
import { BRAND } from "../../constants/brand";
import type { BondPipelineItem } from "../../types";

/**
 * Bond Pipeline — primary-market new-issue tracker. Foreign
 * institutional readers use this to size positioning into upcoming
 * deals (sovereign, sub-sov, corporate). Compact one-line-per-deal
 * editor; renders as a small table in the email and column-aligned
 * text in the BBG paste.
 *
 * Three fields per row:
 *   - Issuer     — free text (company / sovereign / sub-sov)
 *   - Pricing    — ISO date (optional; pre-announcement deals
 *                  often don't have a firm date yet)
 *   - Est. size  — free text so the analyst can use whatever
 *                  convention reads cleanest ("USD 500M",
 *                  "$300-500M", "Up to $1B", "TBD")
 *
 * Layout pattern matches LatestReportsSection so analysts who
 * already know that section can use this one without re-learning.
 */
export default function BondPipelineSection(): React.ReactElement | null {
  const { sections, bondPipeline } = useDailyStore(
    useShallow((s) => ({ sections: s.sections, bondPipeline: s.bondPipeline })),
  );
  const updateListItem = useDailyStore((s) => s.updateListItem);
  const addListItem = useDailyStore((s) => s.addListItem);
  const removeListItem = useDailyStore((s) => s.removeListItem);

  if (!sections.find((x) => x.key === "bondPipeline")?.on) return null;

  const newItem: BondPipelineItem = {
    id: `bp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    issuer: "",
    pricingDate: "",
    estimatedSize: "",
  };

  return (
    <Card title="Bond Pipeline" color={BRAND.blue}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Upcoming primary-market deals — issuer, expected pricing date, estimated size.
        Pre-announcement deals can leave the date blank.
      </p>

      {bondPipeline.length === 0 && (
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
          No deals in the pipeline. Add upcoming new issues below.
        </div>
      )}

      {bondPipeline.map((b) => (
        <div
          key={b.id}
          style={{
            display: "grid",
            // Issuer wider since names like "Republic of Argentina"
            // need room. Date column matches the YYYY-MM-DD width.
            gridTemplateColumns: "1fr 130px 160px 24px",
            gap: 6,
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <Inp
            label=""
            value={b.issuer}
            onChange={(v) => updateListItem("bondPipeline", b.id, "issuer", v)}
            placeholder="Issuer (e.g. Tecpetrol)"
          />
          <Inp
            label=""
            value={b.pricingDate || ""}
            onChange={(v) => updateListItem("bondPipeline", b.id, "pricingDate", v)}
            placeholder="2026-05-12"
          />
          <Inp
            label=""
            value={b.estimatedSize}
            onChange={(v) => updateListItem("bondPipeline", b.id, "estimatedSize", v)}
            placeholder="USD 500M (or range)"
          />
          <X onClick={() => removeListItem("bondPipeline", b.id)} />
        </div>
      ))}

      <DashBtn onClick={() => addListItem("bondPipeline", newItem)}>
        + Add deal
      </DashBtn>
    </Card>
  );
}
