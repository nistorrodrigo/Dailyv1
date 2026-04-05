import useDailyStore from "../../store/useDailyStore";
import { Card, Inp, X, DashBtn } from "../ui";
import MarkdownEditor from "../ui/MarkdownEditor";
import { BRAND } from "../../constants/brand";

export default function MacroSection() {
    const { sections, macroBlocks } = useDailyStore(useShallow((s) => ({ sections: s.sections, macroBlocks: s.macroBlocks })));
    const updateListItem = useDailyStore((s) => s.updateListItem);
  const addListItem = useDailyStore((s) => s.addListItem);
  const removeListItem = useDailyStore((s) => s.removeListItem);

  if (!sections.find((x) => x.key === "macro")?.on) return null;

  return (
    <Card title="Macro / Political" color={BRAND.navy}>
      {macroBlocks.map((b) => (
        <div key={b.id} style={{ marginBottom: 16, padding: 12, background: "#f8f9fa", borderRadius: 6, position: "relative" }}>
          <div style={{ position: "absolute", top: 8, right: 8 }}>
            <X onClick={() => removeListItem("macroBlocks", b.id)} />
          </div>
          <Inp label="Title" value={b.title} onChange={(v) => updateListItem("macroBlocks", b.id, "title", v)} />
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: 0.5, display: "block", marginBottom: 4 }}>Body</label>
            <MarkdownEditor value={b.body} onChange={(v) => updateListItem("macroBlocks", b.id, "body", v)} rows={4} />
          </div>
          <Inp label="LS Pick / Comment" value={b.lsPick} onChange={(v) => updateListItem("macroBlocks", b.id, "lsPick", v)} />
        </div>
      ))}
      <DashBtn onClick={() => addListItem("macroBlocks", { id: Date.now().toString(), title: "", body: "", lsPick: "" })}>
        + Add Macro Block
      </DashBtn>
    </Card>
  );
}
