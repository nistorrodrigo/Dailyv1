import React from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, X, DashBtn } from "../ui";
import { BRAND } from "../../constants/brand";

const is: React.CSSProperties = { padding: "6px 8px", borderRadius: 4, border: "1px solid var(--border-input)", fontSize: 12, boxSizing: "border-box" };

export default function KeyEventsSection() {
    const { sections, keyEvents } = useDailyStore(useShallow((s) => ({ sections: s.sections, keyEvents: s.keyEvents })));
    const addKeyEvent = useDailyStore((s) => s.addKeyEvent);
  const updateKeyEvent = useDailyStore((s) => s.updateKeyEvent);
  const removeKeyEvent = useDailyStore((s) => s.removeKeyEvent);

  if (!sections.find((x) => x.key === "keyEvents")?.on) return null;

  return (
    <Card title="Key Events Calendar" color={BRAND.blue}>
      {keyEvents.map((ke, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <input
            type="date"
            value={ke.date}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateKeyEvent(i, "date", e.target.value)}
            style={{ ...is, width: 150 }}
          />
          <input
            value={ke.event}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateKeyEvent(i, "event", e.target.value)}
            placeholder="Event description"
            style={{ ...is, flex: 1 }}
          />
          <X onClick={() => removeKeyEvent(i)} />
        </div>
      ))}
      <DashBtn onClick={addKeyEvent}>+ Add Key Event</DashBtn>
    </Card>
  );
}
