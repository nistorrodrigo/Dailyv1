import useDailyStore from "../../store/useDailyStore";
import { Card, Inp } from "../ui";
import { BRAND } from "../../constants/brand";

export default function GeneralSection() {
  const date = useDailyStore((s) => s.date);
  const summaryBar = useDailyStore((s) => s.summaryBar);
  const setField = useDailyStore((s) => s.setField);

  return (
    <Card title="General" color={BRAND.navy}>
      <Inp label="Date" value={date} onChange={(v) => setField("date", v)} placeholder="YYYY-MM-DD" />
      <Inp label="Summary Bar" value={summaryBar} onChange={(v) => setField("summaryBar", v)} multi rows={3} placeholder="Top-level summary line..." />
    </Card>
  );
}
