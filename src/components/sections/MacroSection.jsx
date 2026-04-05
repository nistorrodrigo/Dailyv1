import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, Inp, X, DashBtn } from "../ui";
import MarkdownEditor from "../ui/MarkdownEditor";
import { BRAND } from "../../constants/brand";

export default function MacroSection() {
  const { sections, macroBlocks, date } = useDailyStore(useShallow((s) => ({ sections: s.sections, macroBlocks: s.macroBlocks, date: s.date })));
  const updateListItem = useDailyStore((s) => s.updateListItem);
  const addListItem = useDailyStore((s) => s.addListItem);
  const removeListItem = useDailyStore((s) => s.removeListItem);
  const setField = useDailyStore((s) => s.setField);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiContext, setAiContext] = useState("");
  const [showAiInput, setShowAiInput] = useState(false);

  if (!sections.find((x) => x.key === "macro")?.on) return null;

  const handleAiDraft = async () => {
    setAiLoading(true);
    try {
      const resp = await fetch("/api/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: aiContext,
          existingBlocks: macroBlocks.filter((b) => b.body),
          date,
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);

      const newBlocks = data.blocks.map((b, i) => ({
        id: `ai${Date.now()}${i}`,
        title: b.title || "AI DRAFT",
        body: b.body || "",
        lsPick: b.lsPick || "",
      }));

      setField("macroBlocks", [...macroBlocks, ...newBlocks]);
      setShowAiInput(false);
      setAiContext("");

      const cost = data.usage
        ? `(${data.usage.input + data.usage.output} tokens)`
        : "";
      alert(`Added ${newBlocks.length} AI-drafted blocks ${cost}`);
    } catch (err) {
      alert("AI Draft failed: " + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Card title="Macro / Political" color={BRAND.navy}>
      {macroBlocks.map((b) => (
        <div key={b.id} className="mb-4 p-3 rounded-md relative" style={{ background: "var(--bg-card-alt)" }}>
          <div className="absolute top-2 right-2">
            <X onClick={() => removeListItem("macroBlocks", b.id)} />
          </div>
          <Inp label="Title" value={b.title} onChange={(v) => updateListItem("macroBlocks", b.id, "title", v)} />
          <div className="mb-2.5">
            <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Body</label>
            <MarkdownEditor value={b.body} onChange={(v) => updateListItem("macroBlocks", b.id, "body", v)} rows={4} />
          </div>
          <Inp label="LS Pick / Comment" value={b.lsPick} onChange={(v) => updateListItem("macroBlocks", b.id, "lsPick", v)} />
        </div>
      ))}

      <div className="flex gap-2 mb-2">
        <div className="flex-1">
          <DashBtn onClick={() => addListItem("macroBlocks", { id: Date.now().toString(), title: "", body: "", lsPick: "" })}>
            + Add Macro Block
          </DashBtn>
        </div>
        <button
          onClick={() => setShowAiInput(!showAiInput)}
          disabled={aiLoading}
          className="px-4 py-2.5 rounded-md border-2 border-dashed font-semibold text-xs cursor-pointer disabled:opacity-50"
          style={{ borderColor: "#8b5cf6", color: "#8b5cf6", background: "transparent" }}
        >
          {aiLoading ? "Generating..." : "AI Draft"}
        </button>
      </div>

      {showAiInput && (
        <div className="p-3 rounded-md border border-[var(--border-light)] mt-2" style={{ background: "var(--bg-card-alt)" }}>
          <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            Context / notes for AI (optional)
          </label>
          <textarea
            value={aiContext}
            onChange={(e) => setAiContext(e.target.value)}
            rows={3}
            placeholder="E.g. 'BCRA bought $200mn today, inflation came in at 2.1% MoM, treasury auction was oversubscribed...'"
            className="themed-input w-full px-2.5 py-2 rounded-md border border-[var(--border-input)] text-[13px] font-sans leading-relaxed resize-y box-border bg-[var(--bg-input)] text-[var(--text-primary)] mb-2"
          />
          <div className="flex gap-2 items-center">
            <button
              onClick={handleAiDraft}
              disabled={aiLoading}
              className="px-4 py-2 rounded-md border-none text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              style={{ background: "#8b5cf6" }}
            >
              {aiLoading ? "Generating..." : "Generate Draft"}
            </button>
            <button
              onClick={() => { setShowAiInput(false); setAiContext(""); }}
              className="px-3 py-2 rounded-md border border-[var(--border-input)] bg-transparent text-[var(--text-muted)] text-xs cursor-pointer"
            >
              Cancel
            </button>
            <span className="text-[10px] text-[var(--text-muted)]">
              Powered by Claude Haiku — ~$0.002/draft
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}
