import React from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, Inp } from "../ui";

export default function LatAmSection(): React.ReactElement | null {
  const { sections, latam } = useDailyStore(useShallow((s) => ({ sections: s.sections, latam: s.latam })));
  const setField = useDailyStore((s) => s.setField);

  if (!sections.find((x) => x.key === "latam")?.on) return null;

  return (
    <Card title="LatAm Context" color="#8b5cf6">
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 10px" }}>
        1-2 lines on Brazil, Chile, Mexico if relevant for Argentina positioning.
      </p>
      <Inp
        value={latam as string}
        onChange={(v) => setField("latam", v)}
        multi
        rows={3}
        placeholder="e.g. Brazil: Selic held at 14.75%, BRL weakened 0.5%. Chile copper +2% supporting LatAm sentiment."
      />
    </Card>
  );
}
