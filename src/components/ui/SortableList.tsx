import React, { useEffect, useState, lazy, Suspense } from "react";

/**
 * Lazy wrapper around the actual DnD-enabled sortable list. The
 * dnd-kit graph is ~185 KB / ~60 KB gzip — eagerly loading it on
 * the EditorTab's first paint blocks rendering for no reason, since
 * 95% of the time the analyst doesn't drag anything in a session.
 *
 * First paint renders items in a plain stack (with a static drag
 * handle glyph that's inert). The dnd-kit module is dynamically
 * imported one tick after mount via a lazy() — by the time the
 * analyst's eye reaches a section and reaches for a handle, DnD is
 * already wired up. If they're an exceptionally fast clicker, the
 * worst case is a ~200 ms delay before the first drag works.
 *
 * Behaviour from the caller's perspective is unchanged: same props,
 * same reorder callback. Just a cheaper startup.
 */
interface SortableListProps {
  items: { id: string }[];
  onReorder: (from: number, to: number) => void;
  renderItem: (item: { id: string }, index: number) => React.ReactNode;
}

const SortableListDnd = lazy(() => import("./SortableListDnd"));

/** Inert placeholder render — same vertical stack the DnD version
 *  produces, with a non-functional grab-handle glyph so the layout
 *  doesn't shift when the lazy module lands. */
function StaticList({ items, renderItem }: SortableListProps) {
  return (
    <>
      {items.map((item, index) => (
        <div key={item.id} className="flex gap-2">
          <div
            className="flex items-center text-[var(--text-muted)] text-sm px-1 select-none opacity-40"
            title="Loading drag handle…"
          >
            {"☰"}
          </div>
          <div className="flex-1">{renderItem(item, index)}</div>
        </div>
      ))}
    </>
  );
}

export default function SortableList(props: SortableListProps): React.ReactElement {
  // Defer until after first paint so the static list renders
  // immediately without paying the dnd-kit import cost on the
  // critical path. requestIdleCallback would be even better but
  // isn't reliably present everywhere.
  const [enableDnd, setEnableDnd] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setEnableDnd(true), 0);
    return () => clearTimeout(id);
  }, []);

  if (!enableDnd) return <StaticList {...props} />;

  return (
    <Suspense fallback={<StaticList {...props} />}>
      <SortableListDnd {...props} />
    </Suspense>
  );
}
