import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import useDailyStore from "../../store/useDailyStore";
import { Toggle } from "../ui";
import { BRAND } from "../../constants/brand";
import type { Section } from "../../types";

/**
 * DnD-enabled inner part of SectionToggleList — extracted into its
 * own module so the dnd-kit graph (~185 KB / ~60 KB gzip) stays in
 * the lazy chunk. The wrapper at SectionToggleList.tsx renders a
 * static, drag-disabled list on first paint and dynamically imports
 * this file one tick after mount.
 */

function SortableItem({ sec }: { sec: Section }) {
  const toggleSection = useDailyStore((s) => s.toggleSection);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sec.key });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
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
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: "grab",
          color: "#aaa",
          fontSize: 16,
          padding: "0 4px",
          userSelect: "none",
        }}
      >
        {"☰"}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
        {sec.label}
      </span>
      <Toggle checked={sec.on} onChange={() => toggleSection(sec.key)} label="" />
    </div>
  );
}

interface SectionToggleListDndProps {
  sections: Section[];
  onReorder: (next: Section[]) => void;
}

export default function SectionToggleListDnd({ sections, onReorder }: SectionToggleListDndProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.key === active.id);
    const newIndex = sections.findIndex((s) => s.key === over.id);
    onReorder(arrayMove(sections, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sections.map((s) => s.key)} strategy={verticalListSortingStrategy}>
        {sections.map((sec) => (
          <SortableItem key={sec.key} sec={sec} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
