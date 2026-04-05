import useDailyStore from "../../store/useDailyStore";
import { Card, Inp } from "../ui";
import { BRAND } from "../../constants/brand";

export default function FlowsSection() {
  const sections = useDailyStore((s) => s.sections);
  const eqBuyer = useDailyStore((s) => s.eqBuyer);
  const eqSeller = useDailyStore((s) => s.eqSeller);
  const fiBuyer = useDailyStore((s) => s.fiBuyer);
  const fiSeller = useDailyStore((s) => s.fiSeller);
  const setField = useDailyStore((s) => s.setField);

  if (!sections.find((x) => x.key === "flows")?.on) return null;

  return (
    <Card title="LS Desk Flows" color={BRAND.teal}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ padding: 10, background: "#f4faf0", borderRadius: 6 }}>
          <Inp label="EQ Net Buyer" value={eqBuyer} onChange={(v) => setField("eqBuyer", v)} multi rows={2} />
        </div>
        <div style={{ padding: 10, background: "#fdf5f3", borderRadius: 6 }}>
          <Inp label="EQ Net Seller" value={eqSeller} onChange={(v) => setField("eqSeller", v)} multi rows={2} />
        </div>
        <div style={{ padding: 10, background: "#f4faf0", borderRadius: 6 }}>
          <Inp label="FI Net Buyer" value={fiBuyer} onChange={(v) => setField("fiBuyer", v)} multi rows={2} />
        </div>
        <div style={{ padding: 10, background: "#fdf5f3", borderRadius: 6 }}>
          <Inp label="FI Net Seller" value={fiSeller} onChange={(v) => setField("fiSeller", v)} multi rows={2} />
        </div>
      </div>
    </Card>
  );
}
