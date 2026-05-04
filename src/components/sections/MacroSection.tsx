import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, Inp, X, DashBtn, NewsLinksEditor } from "../ui";
import { makeUrlPasteHandler } from "../../hooks/useUrlPasteHint";
import SortableList from "../ui/SortableList";
import MarkdownEditor from "../ui/MarkdownEditor";
import { CopyPromptBtn, ImproveBtn } from "../ui/AIHelpers";
import { BRAND } from "../../constants/brand";
import { toast } from "../../store/useToastStore";
import { AI_MODELS, estimateCost, type AIModelKey } from "../ui/AIModelPicker";
import { authedFetch } from "../../lib/authedFetch";
import { MACRO_BLOCK_TEMPLATES } from "../../constants/macroBlockTemplates";
import useCustomTemplatesStore from "../../store/useCustomTemplatesStore";

export default function MacroSection() {
  const { sections, macroBlocks, date, analysts } = useDailyStore(useShallow((s) => ({
    sections: s.sections, macroBlocks: s.macroBlocks, date: s.date, analysts: s.analysts,
  })));
  const updateListItem = useDailyStore((s) => s.updateListItem);
  const addListItem = useDailyStore((s) => s.addListItem);
  const reorderList = useDailyStore((s) => s.reorderList);
  const removeListItem = useDailyStore((s) => s.removeListItem);
  const setField = useDailyStore((s) => s.setField);

  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [aiContext, setAiContext] = useState<string>("");
  const [showAiInput, setShowAiInput] = useState<boolean>(false);
  const [aiModel, setAiModel] = useState<AIModelKey>("sonnet");
  const [aiMode, setAiMode] = useState<"macro" | "full">("macro");
  const [includeNews, setIncludeNews] = useState<boolean>(true);
  // Template picker open/closed state. Toggled by the "+ From template"
  // button below the existing add-block control.
  const [showTemplates, setShowTemplates] = useState<boolean>(false);
  const customTemplates = useCustomTemplatesStore((s) => s.templates);
  const addCustomTemplate = useCustomTemplatesStore((s) => s.add);
  const removeCustomTemplate = useCustomTemplatesStore((s) => s.remove);
  // Last-call usage so the post-toast badge can show actual spend
  // alongside tokens — the AIModelPicker's pre-flight cost is just an
  // estimate; this is what the call really cost.
  const [lastUsage, setLastUsage] = useState<{ tokens: number; cost: number } | null>(null);

  if (!sections.find((x) => x.key === "macro")?.on) return null;

  const handleAiDraft = async () => {
    if (aiMode === "full" && !window.confirm("Generate a FULL daily draft? This will add content to Macro, Trade Ideas, and Flows sections.")) return;

    setAiLoading(true);
    try {
      const resp = await authedFetch("/api/ai-draft", {
        method: "POST",
        body: JSON.stringify({
          context: aiContext,
          existingBlocks: macroBlocks.filter((b) => b.body),
          date,
          model: aiModel,
          mode: aiMode,
          includeNews,
          analysts: aiMode === "full" ? analysts : undefined,
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);

      if (aiMode === "full" && data.daily) {
        const d = data.daily;
        // Apply full daily draft
        if (d.summaryBar) setField("summaryBar", d.summaryBar);
        if (d.macroBlocks?.length) {
          const newBlocks = d.macroBlocks.map((b: Record<string, string>, i: number) => ({
            id: `ai${Date.now()}${i}`, title: b.title || "", body: b.body || "", lsPick: b.lsPick || "",
          }));
          setField("macroBlocks", [...macroBlocks, ...newBlocks]);
        }
        if (d.equityPicks?.length) setField("equityPicks", d.equityPicks);
        if (d.fiIdeas?.length) setField("fiIdeas", d.fiIdeas);
        if (d.eqBuyer) setField("eqBuyer", d.eqBuyer);
        if (d.eqSeller) setField("eqSeller", d.eqSeller);
        if (d.fiBuyer) setField("fiBuyer", d.fiBuyer);
        if (d.fiSeller) setField("fiSeller", d.fiSeller);
      } else if (data.blocks) {
        const newBlocks = data.blocks.map((b: Record<string, string>, i: number) => ({
          id: `ai${Date.now()}${i}`, title: b.title || "AI DRAFT", body: b.body || "", lsPick: b.lsPick || "",
        }));
        setField("macroBlocks", [...macroBlocks, ...newBlocks]);
      }

      setShowAiInput(false);
      setAiContext("");

      const inputTokens = data.usage?.input || 0;
      const outputTokens = data.usage?.output || 0;
      const tokens = inputTokens + outputTokens;
      const cost = estimateCost(aiModel, inputTokens, outputTokens);
      setLastUsage({ tokens, cost });
      toast.success(`${aiMode === "full" ? "Full daily" : "Macro blocks"} drafted with ${data.model} (${tokens.toLocaleString()} tokens · $${cost.toFixed(4)})`);
    } catch (err: unknown) {
      toast.error("AI Draft failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setAiLoading(false);
    }
  };

  const selectedModel = AI_MODELS.find((m) => m.key === aiModel);

  return (
    <Card title="Macro / Political" color={BRAND.navy}>
      <SortableList
        items={macroBlocks}
        onReorder={(from, to) => reorderList("macroBlocks", from, to)}
        renderItem={(item) => {
          const b = macroBlocks.find((x) => x.id === item.id)!;
          return (
            <div className="mb-4 p-3 rounded-md relative" style={{ background: "var(--bg-card-alt)" }}>
              <div className="absolute top-2 right-2 flex items-center gap-1">
                {/* "Save as template" — preserves this block's title +
                    body + lsPick into the analyst's localStorage
                    template library for next time. Useful for
                    block types not covered by the 10 built-ins
                    (e.g. "BCRA SWAP NETWORK", "ENARGAS UPDATE")
                    or when the analyst's preferred phrasing
                    differs from the built-in skeleton. */}
                <button
                  onClick={() => {
                    if (!b.title?.trim() && !b.body?.trim()) {
                      toast.info("Add a title or body before saving as a template.");
                      return;
                    }
                    const label = window.prompt(
                      "Template label (e.g. 'BCRA swap network'):",
                      b.title || "Custom template",
                    );
                    if (!label?.trim()) return;
                    const description = window.prompt(
                      "One-line description for the picker (optional):",
                      "",
                    ) || "";
                    addCustomTemplate({
                      label: label.trim(),
                      description: description.trim(),
                      title: b.title || "",
                      body: b.body || "",
                      lsPick: b.lsPick || "",
                    });
                    toast.success(`Saved "${label.trim()}" — pick it from "From template".`);
                  }}
                  className="bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--color-teal)] text-base p-1 leading-none"
                  title="Save this block's title + body + LS pick as a reusable custom template"
                  aria-label="Save block as template"
                >
                  ★
                </button>
                <X onClick={() => removeListItem("macroBlocks", b.id)} />
              </div>
              <Inp label="Title" value={b.title} onChange={(v) => updateListItem("macroBlocks", b.id, "title", v)} />
              <div className="mb-2.5">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Body</label>
                  <div className="flex gap-1.5">
                    <ImproveBtn text={b.body} onImprove={(v) => updateListItem("macroBlocks", b.id, "body", v)} context={b.title || "macro block"} />
                    <CopyPromptBtn section="Macro / Political" currentText={b.body} />
                  </div>
                </div>
                <MarkdownEditor
                  value={b.body}
                  onChange={(v) => updateListItem("macroBlocks", b.id, "body", v)}
                  rows={4}
                  onPaste={makeUrlPasteHandler(b.newsLinks, (next) => updateListItem("macroBlocks", b.id, "newsLinks", next))}
                />
              </div>
              <Inp label="LS Pick / Comment" value={b.lsPick} onChange={(v) => updateListItem("macroBlocks", b.id, "lsPick", v)} />
              <NewsLinksEditor
                links={b.newsLinks}
                onChange={(next) => updateListItem("macroBlocks", b.id, "newsLinks", next)}
              />
            </div>
          );
        }}
      />

      <div className="flex gap-2 mb-2">
        <div className="flex-1">
          <DashBtn onClick={() => addListItem("macroBlocks", { id: Date.now().toString(), title: "", body: "", lsPick: "" })}>
            + Add Macro Block
          </DashBtn>
        </div>
        <button
          onClick={() => setShowTemplates((v) => !v)}
          className="px-4 py-2.5 rounded-md border-2 border-dashed font-semibold text-xs cursor-pointer"
          style={{ borderColor: BRAND.teal, color: BRAND.teal, background: showTemplates ? "rgba(35,162,158,0.08)" : "transparent" }}
          title="Pick a recurring block type and pre-fill the title + body skeleton"
        >
          {showTemplates ? "Close templates" : "From template"}
        </button>
        <button
          onClick={() => setShowAiInput(!showAiInput)}
          disabled={aiLoading}
          className="px-4 py-2.5 rounded-md border-2 border-dashed font-semibold text-xs cursor-pointer disabled:opacity-50"
          style={{ borderColor: "#8b5cf6", color: "#8b5cf6", background: "transparent" }}
        >
          {aiLoading ? "Generating..." : "AI Draft"}
        </button>
      </div>

      {/* Template picker — recurring-block library. Each entry
          pre-fills a new macroBlock with title + body skeleton +
          lsPick stub. Designed to compress the cold-start time on
          predictable block types (BCRA decision, Treasury auction,
          CPI print, etc.) — fill the brackets, ship.
          Custom templates from the analyst's localStorage render
          first with a star prefix; built-ins follow. */}
      {showTemplates && (
        <div className="mb-3 p-3 rounded-md border border-[var(--border-light)]" style={{ background: "var(--bg-card-alt)" }}>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-secondary)] mb-2">
            Pick a template
          </div>
          {customTemplates.length > 0 && (
            <>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: BRAND.teal }}>
                Your saved templates
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                {customTemplates.map((t) => (
                  <div
                    key={t.id}
                    className="text-left p-2.5 rounded-md border bg-transparent flex items-start gap-2"
                    style={{ borderColor: BRAND.teal + "40" }}
                  >
                    <button
                      onClick={() => {
                        addListItem("macroBlocks", {
                          id: `tpl-${t.id}-${Date.now()}`,
                          title: t.title,
                          body: t.body,
                          lsPick: t.lsPick,
                        });
                        setShowTemplates(false);
                        toast.success(`Inserted "${t.label}" — your saved template.`);
                      }}
                      className="flex-1 text-left bg-transparent border-none cursor-pointer p-0"
                    >
                      <div className="text-[12px] font-bold text-[var(--text-primary)] mb-0.5 flex items-center gap-1">
                        <span style={{ color: BRAND.teal }}>★</span>
                        <span>{t.label}</span>
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] leading-snug">{t.description || "(no description)"}</div>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete the saved template "${t.label}"?`)) {
                          removeCustomTemplate(t.id);
                          toast.info("Template deleted.");
                        }
                      }}
                      className="bg-transparent border-none text-[var(--text-muted)] cursor-pointer text-base leading-none p-1"
                      title="Delete this template"
                      aria-label={`Delete template ${t.label}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                Built-in templates
              </div>
            </>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {MACRO_BLOCK_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  addListItem("macroBlocks", {
                    id: `tpl-${t.id}-${Date.now()}`,
                    title: t.title,
                    body: t.body,
                    lsPick: t.lsPick,
                  });
                  setShowTemplates(false);
                  toast.success(`Inserted "${t.label}" template — fill in the brackets.`);
                }}
                className="text-left p-2.5 rounded-md border bg-transparent cursor-pointer hover:bg-[var(--bg-hover)]"
                style={{ borderColor: "var(--border-light)" }}
              >
                <div className="text-[12px] font-bold text-[var(--text-primary)] mb-0.5">{t.label}</div>
                <div className="text-[10px] text-[var(--text-muted)] leading-snug">{t.description}</div>
              </button>
            ))}
          </div>
          <div className="mt-2 text-[10px] text-[var(--text-muted)] italic">
            Bodies use [bracketed prompts] — replace each with the day's data.
            Click ★ on any block in the editor to save it as a custom template.
          </div>
        </div>
      )}

      {showAiInput && (
        <div className="p-3 rounded-md border border-[var(--border-light)] mt-2" style={{ background: "var(--bg-card-alt)" }}>
          {/* Mode selector */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setAiMode("macro")}
              className={`flex-1 py-2 rounded-md text-xs font-bold border cursor-pointer ${
                aiMode === "macro"
                  ? "border-[#8b5cf6] text-white"
                  : "border-[var(--border-input)] text-[var(--text-muted)] bg-transparent"
              }`}
              style={aiMode === "macro" ? { background: "#8b5cf6" } : {}}
            >
              Macro Only
            </button>
            <button
              onClick={() => setAiMode("full")}
              className={`flex-1 py-2 rounded-md text-xs font-bold border cursor-pointer ${
                aiMode === "full"
                  ? "border-[#8b5cf6] text-white"
                  : "border-[var(--border-input)] text-[var(--text-muted)] bg-transparent"
              }`}
              style={aiMode === "full" ? { background: "#8b5cf6" } : {}}
            >
              Full Daily
            </button>
          </div>

          {/* Model selector */}
          <div className="mb-3">
            <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Model</label>
            <div className="flex gap-1.5">
              {AI_MODELS.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setAiModel(m.key)}
                  className={`flex-1 py-1.5 rounded text-[10px] font-bold border cursor-pointer ${
                    aiModel === m.key
                      ? "border-[#8b5cf6] text-[#8b5cf6]"
                      : "border-[var(--border-input)] text-[var(--text-muted)]"
                  }`}
                  style={{ background: aiModel === m.key ? "rgba(139,92,246,0.1)" : "transparent" }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="text-[10px] text-[var(--text-muted)] mt-1">
              Estimated: {selectedModel?.costLabel}/draft
              {lastUsage && (
                <span className="ml-2">
                  · Last call: {lastUsage.tokens.toLocaleString()} tokens · ${lastUsage.cost.toFixed(4)}
                </span>
              )}
            </div>
          </div>

          {/* Context input */}
          {/* Include news toggle */}
          <div className="flex items-center justify-between mb-3 p-2 rounded bg-[var(--bg-card-alt)] border border-[var(--border-light)]">
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">Include Argentina news</div>
              <div className="text-[10px] text-[var(--text-muted)]">Fetches latest headlines as context for AI</div>
            </div>
            <button
              onClick={() => setIncludeNews(!includeNews)}
              className="relative w-10 h-5 rounded-full cursor-pointer border-none"
              style={{ background: includeNews ? "#8b5cf6" : "#c8cdd3" }}
            >
              <div className="absolute top-[2px] w-[16px] h-[16px] rounded-full bg-white shadow-sm transition-[left] duration-200"
                style={{ left: includeNews ? 22 : 2 }} />
            </button>
          </div>

          <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            Context / notes (optional)
          </label>
          <textarea
            value={aiContext}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAiContext(e.target.value)}
            rows={3}
            placeholder={aiMode === "full"
              ? "E.g. 'Risk-on day, BCRA bought $200mn, inflation 2.1%, banks rallying on earnings...'"
              : "E.g. 'BCRA bought $200mn today, inflation came in at 2.1% MoM...'"
            }
            className="themed-input w-full px-2.5 py-2 rounded-md border border-[var(--border-input)] text-[13px] font-sans leading-relaxed resize-y box-border bg-[var(--bg-input)] text-[var(--text-primary)] mb-2"
          />
          <div className="flex gap-2 items-center">
            <button
              onClick={handleAiDraft}
              disabled={aiLoading}
              className="px-4 py-2 rounded-md border-none text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              style={{ background: "#8b5cf6" }}
            >
              {aiLoading ? "Generating..." : aiMode === "full" ? "Generate Full Daily" : "Generate Macro Blocks"}
            </button>
            <button
              onClick={() => { setShowAiInput(false); setAiContext(""); }}
              className="px-3 py-2 rounded-md border border-[var(--border-input)] bg-transparent text-[var(--text-muted)] text-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
