import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import useDailyStore from "../../store/useDailyStore";
import { Card, Toggle } from "../ui";
import { BRAND } from "../../constants/brand";

function SortableItem({ sec }) {
  const toggleSection = useDailyStore((s) => s.toggleSection);
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: sec.key });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: "flex", alignItems: "center", gap: 10,
    padding: "8px 10px", marginBottom: 4,
    background: sec.on ? "var(--bg-section-on)" : "var(--bg-section-off)",
    borderRadius: 6, border: `1px solid ${sec.on ? BRAND.sky + "40" : "var(--border-section)"}`,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        style={{
          cursor: "grab", color: "#aaa", fontSize: 16,
          padding: "0 4px", userSelect: "none",
        }}
      >
        {"\u2630"}
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", flex: 1 }}>
        {sec.label}
      </span>
      <Toggle
        checked={sec.on}
        onChange={() => toggleSection(sec.key)}
        label=""
      />
    </div>
  );
}

export default function SectionToggleList() {
  const sections = useDailyStore((s) => s.sections);
  const setField = useDailyStore((s) => s.setField);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((s) => s.key === active.id);
    const newIndex = sections.findIndex((s) => s.key === over.id);
    setField("sections", arrayMove(sections, oldIndex, newIndex));
  };

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
            onClick={() => setField("sections", sections.map((s) => ({ ...s, on: ["macro","tradeIdeas","flows","macroEstimates","corporate","research"].includes(s.key) })))}
            className="px-2 py-1 rounded text-[9px] font-bold bg-transparent border border-[var(--border-input)] text-[var(--text-secondary)] cursor-pointer hover:bg-[var(--bg-hover)]"
          >
            Default
          </button>
        </div>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections.map((s) => s.key)} strategy={verticalListSortingStrategy}>
          {sections.map((sec) => (
            <SortableItem key={sec.key} sec={sec} />
          ))}
        </SortableContext>
      </DndContext>
    </Card>
  );
}
