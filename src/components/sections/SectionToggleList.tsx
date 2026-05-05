import { useEffect, useState, Suspense } from "react";
import useDailyStore from "../../store/useDailyStore";
import { Card, Toggle } from "../ui";
import { BRAND } from "../../constants/brand";
import { lazyWithReload } from "../../lib/lazyWithReload";
import type { Section } from "../../types";

/**
 * Section toggle + reorder list — the toggle behaviour is eager
 * (Toggle component is cheap), the drag-to-reorder is dnd-kit-
 * powered and lazy. Same trick as SortableList: render a static
 * list on first paint with an inert grab handle, dynamically import
 * the DnD-enabled inner component one tick after mount.
 *
 * The dnd-kit chunk (~185 KB / ~60 KB gzip) is shared with
 * SortableList; whichever component triggers it first warms the
 * cache for the other.
 */

// `lazyWithReload` recovers from stale-bundle errors after a deploy.
const SectionToggleListDnd = lazyWithReload(() => import("./SectionToggleListDnd"));

function StaticItem({ sec, onToggle }: { sec: Section; onToggle: () => void }) {
  // Same visual as the DnD version but with a non-functional grab
  // handle (40% opacity, no listeners). Layout is identical so the
  // lazy DnD swap doesn't shift anything.
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    marginBottom: 4,
    background: sec.on ? "var(--bg-section-on)" : "var(--bg-section-off)",
    borderRadius: 6,
    border: `1px solid ${sec.on ? BRAND.sky + "40" : "var(--border-section)"}`,
  };
  return (
    <div style={style}>
      <div
        style={{
          cursor: "default",
          color: "#aaa",
          opacity: 0.4,
          fontSize: 16,
          padding: "0 4px",
          userSelect: "none",
        }}
        title="Loading drag handle…"
      >
        {"☰"}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
        {sec.label}
      </span>
      <Toggle checked={sec.on} onChange={onToggle} label="" />
    </div>
  );
}

export default function SectionToggleList() {
  const sections = useDailyStore((s) => s.sections);
  const setField = useDailyStore((s) => s.setField);
  const toggleSection = useDailyStore((s) => s.toggleSection);

  // Defer dnd-kit import until after first paint — the static list
  // renders immediately and the analyst doesn't pay the dnd cost on
  // the critical path.
  const [enableDnd, setEnableDnd] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setEnableDnd(true), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <Card title="Sections — Toggle & Reorder" color={BRAND.navy}>
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-[11px] text-[var(--text-muted)] m-0">
          Toggle on/off and drag to reorder.
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={() => setField("sections", sections.map((s) => ({ ...s, on: true })))}
            className="px-2 py-1 rounded text-[9px] font-bold bg-transparent border border-[var(--border-input)] text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-hover)]"
          >
            All On
          </button>
          <button
            onClick={() => setField("sections", sections.map((s) => ({ ...s, on: false })))}
            className="px-2 py-1 rounded text-[9px] font-bold bg-transparent border border-[var(--border-input)] text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-hover)]"
          >
            All Off
          </button>
          <button
            onClick={() => setField("sections", sections.map((s) => ({ ...s, on: ["macro", "tradeIdeas", "flows", "macroEstimates", "corporate", "research"].includes(s.key) })))}
            className="px-2 py-1 rounded text-[9px] font-bold bg-transparent border border-[var(--border-input)] text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-hover)]"
          >
            Default
          </button>
        </div>
      </div>
      {enableDnd ? (
        <Suspense
          fallback={
            <>
              {sections.map((sec) => (
                <StaticItem key={sec.key} sec={sec} onToggle={() => toggleSection(sec.key)} />
              ))}
            </>
          }
        >
          <SectionToggleListDnd
            sections={sections}
            onReorder={(next) => setField("sections", next)}
          />
        </Suspense>
      ) : (
        sections.map((sec) => (
          <StaticItem key={sec.key} sec={sec} onToggle={() => toggleSection(sec.key)} />
        ))
      )}
    </Card>
  );
}
