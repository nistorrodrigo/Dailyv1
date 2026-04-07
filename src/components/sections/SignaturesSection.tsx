import useDailyStore from "../../store/useDailyStore";
import { Card, Inp, X, DashBtn } from "../ui";
import { BRAND } from "../../constants/brand";

export default function SignaturesSection() {
  const signatures = useDailyStore((s) => s.signatures);
  const disclaimer = useDailyStore((s) => s.disclaimer);
  const updateListItem = useDailyStore((s) => s.updateListItem);
  const addListItem = useDailyStore((s) => s.addListItem);
  const removeListItem = useDailyStore((s) => s.removeListItem);
  const setField = useDailyStore((s) => s.setField);

  return (
    <Card title="Signatures & Disclaimer" color={BRAND.navy}>
      {signatures.map((sig) => (
        <div key={sig.id} style={{ marginBottom: 12, padding: 12, background: "#f8f9fa", borderRadius: 6, position: "relative" }}>
          <div style={{ position: "absolute", top: 8, right: 8 }}>
            <X onClick={() => removeListItem("signatures", sig.id)} />
          </div>
          <Inp label="Name" value={sig.name} onChange={(v) => updateListItem("signatures", sig.id, "name", v)} />
          <Inp label="Role" value={sig.role} onChange={(v) => updateListItem("signatures", sig.id, "role", v)} />
          <Inp label="Email" value={sig.email} onChange={(v) => updateListItem("signatures", sig.id, "email", v)} />
        </div>
      ))}
      <DashBtn onClick={() => addListItem("signatures", { id: Date.now().toString(), name: "", role: "", email: "" })}>
        + Add Signature
      </DashBtn>
      <div style={{ marginTop: 16, borderTop: "1px solid var(--border-light)", paddingTop: 16 }}>
        <Inp label="Email Disclaimer" value={disclaimer || ""} onChange={(v) => setField("disclaimer", v)} multi rows={3} placeholder="Legal disclaimer text for email footer..." />
      </div>
    </Card>
  );
}
