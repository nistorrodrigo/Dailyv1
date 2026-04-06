import React from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableItemWrapperProps {
  id: string;
  children: React.ReactNode;
}

function SortableItemWrapper({ id, children }: SortableItemWrapperProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <div className="flex gap-2">
        <div
          {...attributes}
          {...listeners}
          className="flex items-center cursor-grab text-[var(--text-muted)] text-sm px-1 select-none hover:text-[var(--text-primary)]"
          title="Drag to reorder"
        >
          {"\u2630"}
        </div>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

interface SortableListProps {
  items: { id: string }[];
  onReorder: (from: number, to: number) => void;
  renderItem: (item: { id: string }, index: number) => React.ReactNode;
}

export default function SortableList({ items, onReorder, renderItem }: SortableListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === String(active.id));
    const newIndex = items.findIndex((item) => item.id === String(over.id));
    if (oldIndex !== -1 && newIndex !== -1) onReorder(oldIndex, newIndex);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item, index) => (
          <SortableItemWrapper key={item.id} id={item.id}>
            {renderItem(item, index)}
          </SortableItemWrapper>
        ))}
      </SortableContext>
    </DndContext>
  );
}
