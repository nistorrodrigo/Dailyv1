import React from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, Inp } from "../ui";
import { BRAND } from "../../constants/brand";

/**
 * Market Comment — single free-form prose block. The "desk colour /
 * opinion" piece that goes alongside the macro reactions and trade
 * ideas. Distinct from `macroBlocks` (which are individual reactions
 * to specific data prints with a structured title + body + LS-pick
 * shape) and from `flows` (desk colour as raw notes).
 *
 * Single text field — no title (rendered as a fixed "MARKET COMMENT"
 * header), no author (signed by the daily's signatures block), no
 * sub-fields. Keep it intentionally bare so the analyst can write
 * however they want.
 */
export default function MarketCommentSection(): React.ReactElement | null {
  const { sections, marketComment } = useDailyStore(
    useShallow((s) => ({ sections: s.sections, marketComment: s.marketComment })),
  );
  const setField = useDailyStore((s) => s.setField);

  if (!sections.find((x) => x.key === "marketComment")?.on) return null;

  return (
    <Card title="Market Comment" color={BRAND.teal}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px" }}>
        Free-form market commentary in your own voice — desk colour, narrative, opinion.
        Goes after the snapshot, before the macro blocks.
      </p>
      <Inp
        label="Body"
        value={marketComment}
        onChange={(v) => setField("marketComment", v)}
        multi
        rows={6}
        placeholder="Yesterday's BCRA decision skewed expectations… The desk views the front-end of the BONCAP curve as the cleanest expression of…"
      />
    </Card>
  );
}
