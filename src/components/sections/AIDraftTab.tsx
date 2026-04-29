import React, { useState } from "react";
import { BRAND } from "../../constants/brand";
import useDailyStore from "../../store/useDailyStore";
import { useShallow } from "zustand/react/shallow";
import { toast } from "../../store/useToastStore";

interface DraftBlock {
  id: string;
  section: string;
  title?: string;
  body?: string;
  lsPick?: string;
  ticker?: string;
  reason?: string;
  idea?: string;
  accepted: boolean;
  rejected: boolean;
}

interface FullDraft {
  summaryBar?: string;
  macroBlocks?: { title: string; body: string; lsPick: string }[];
  equityPicks?: { ticker: string; reason: string }[];
  fiIdeas?: { idea: string; reason: string }[];
  eqBuyer?: string;
  eqSeller?: string;
  fiBuyer?: string;
  fiSeller?: string;
}

const AI_MODELS = [
  { key: "haiku", label: "Haiku 4.5", cost: "$0.002" },
  { key: "sonnet", label: "Sonnet 4.6", cost: "$0.012" },
  { key: "opus", label: "Opus 4.6", cost: "$0.06" },
];

export default function AIDraftTab(): React.ReactElement {
  const { date, analysts } = useDailyStore(useShallow((s) => ({ date: s.date, analysts: s.analysts })));
  const setField = useDailyStore((s) => s.setField);
  const macroBlocks = useDailyStore((s) => s.macroBlocks);

  const [model, setModel] = useState("sonnet");
  const [context, setContext] = useState("");
  const [includeNews, setIncludeNews] = useState(true);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<DraftBlock[]>([]);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [flowsDraft, setFlowsDraft] = useState<{ eqBuyer: string; eqSeller: string; fiBuyer: string; fiSeller: string } | null>(null);
  const [generated, setGenerated] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setDraft([]);
    setSummaryDraft("");
    setFlowsDraft(null);
    setGenerated(false);
    try {
      const resp = await fetch("/api/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          date,
          model,
          mode: "full",
          includeNews,
          analysts,
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);

      const d: FullDraft = data.daily || {};
      const blocks: DraftBlock[] = [];

      if (d.summaryBar) setSummaryDraft(d.summaryBar);

      (d.macroBlocks || []).forEach((b, i) => {
        blocks.push({ id: `macro-${i}`, section: "Macro", title: b.title, body: b.body, lsPick: b.lsPick, accepted: false, rejected: false });
      });
      (d.equityPicks || []).forEach((p, i) => {
        blocks.push({ id: `eq-${i}`, section: "Equity Pick", ticker: p.ticker, reason: p.reason, accepted: false, rejected: false });
      });
      (d.fiIdeas || []).forEach((f, i) => {
        blocks.push({ id: `fi-${i}`, section: "FI Idea", idea: f.idea, reason: f.reason, accepted: false, rejected: false });
      });

      if (d.eqBuyer || d.eqSeller || d.fiBuyer || d.fiSeller) {
        setFlowsDraft({ eqBuyer: d.eqBuyer || "", eqSeller: d.eqSeller || "", fiBuyer: d.fiBuyer || "", fiSeller: d.fiSeller || "" });
      }

      setDraft(blocks);
      setGenerated(true);

      const tokens = data.usage ? data.usage.input + data.usage.output : 0;
      toast.success(`Draft generated with ${data.model} (${tokens} tokens). Review below.`);
    } catch (err) {
      toast.error("AI Draft failed: " + ((err as Error).message));
    } finally {
      setLoading(false);
    }
  };

  const toggleBlock = (id: string, action: "accept" | "reject") => {
    setDraft((prev) => prev.map((b) =>
      b.id === id
        ? { ...b, accepted: action === "accept" ? !b.accepted : false, rejected: action === "reject" ? !b.rejected : false }
        : b
    ));
  };

  const handleApply = () => {
    const accepted = draft.filter((b) => b.accepted);
    if (!accepted.length && !summaryDraft) {
      toast.info("Accept at least one item first");
      return;
    }

    // Apply summary
    if (summaryDraft) setField("summaryBar", summaryDraft);

    // Apply macro blocks
    const newMacros = accepted.filter((b) => b.section === "Macro").map((b, i) => ({
      id: `ai${Date.now()}${i}`, title: b.title || "", body: b.body || "", lsPick: b.lsPick || "",
    }));
    if (newMacros.length) setField("macroBlocks", [...macroBlocks, ...newMacros]);

    // Apply equity picks
    const newEquity = accepted.filter((b) => b.section === "Equity Pick").map((b, i) => ({
      id: `ep-ai-${Date.now()}-${i}`, ticker: b.ticker || "", reason: b.reason || "",
    }));
    if (newEquity.length) setField("equityPicks", newEquity);

    // Apply FI ideas
    const newFI = accepted.filter((b) => b.section === "FI Idea").map((b, i) => ({
      id: `fi-ai-${Date.now()}-${i}`, idea: b.idea || "", reason: b.reason || "",
    }));
    if (newFI.length) setField("fiIdeas", newFI);

    // Apply flows
    if (flowsDraft) {
      setField("eqBuyer", flowsDraft.eqBuyer);
      setField("eqSeller", flowsDraft.eqSeller);
      setField("fiBuyer", flowsDraft.fiBuyer);
      setField("fiSeller", flowsDraft.fiSeller);
    }

    toast.success(`Applied ${accepted.length} items to the daily`);
  };

  const acceptedCount = draft.filter((b) => b.accepted).length;
  const selectedModel = AI_MODELS.find((m) => m.key === model);

  return (
    <div className="max-w-[900px] mx-auto p-5">
      {/* Generator Controls */}
      <div className="p-5 rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] mb-5">
        <div className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-4">AI Draft Generator</div>

        {/* Model selector */}
        <div className="flex gap-2 mb-4">
          {AI_MODELS.map((m) => (
            <button
              key={m.key}
              onClick={() => setModel(m.key)}
              className={`flex-1 py-2.5 rounded-md text-xs font-bold border cursor-pointer ${
                model === m.key ? "text-white" : "border-[var(--border-input)] text-[var(--text-muted)] bg-transparent"
              }`}
              style={model === m.key ? { background: "#8b5cf6", borderColor: "#8b5cf6" } : {}}
            >
              {m.label} <span className="font-normal opacity-70">{m.cost}</span>
            </button>
          ))}
        </div>

        {/* Include news toggle */}
        <div className="flex items-center justify-between mb-4 p-2.5 rounded bg-[var(--bg-card-alt)] border border-[var(--border-light)]">
          <div>
            <div className="text-xs font-semibold text-[var(--text-primary)]">Include Argentina news</div>
            <div className="text-[10px] text-[var(--text-muted)]">Fetches latest headlines as context</div>
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

        {/* Context */}
        <textarea
          value={context}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setContext(e.target.value)}
          rows={3}
          placeholder="Optional context: 'BCRA bought $200mn, inflation 2.1%, banks rallying on earnings, IMF board meeting tomorrow...'"
          className="themed-input w-full px-3 py-2.5 rounded-md border border-[var(--border-input)] text-[13px] font-sans leading-relaxed resize-y bg-[var(--bg-input)] text-[var(--text-primary)] mb-4"
        />

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-3 rounded-md border-none text-white text-sm font-bold cursor-pointer uppercase disabled:opacity-50"
          style={{ background: loading ? "#999" : "#8b5cf6" }}
        >
          {loading ? "Generating full daily draft..." : "Generate AI Draft"}
        </button>
      </div>

      {/* Draft Review */}
      {generated && (
        <>
          {/* Summary */}
          {summaryDraft && (
            <div className="p-4 rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Summary Bar</span>
                <span className="text-[10px] text-green-600 font-semibold">Auto-included</span>
              </div>
              <div className="text-[13px] text-[var(--text-primary)] leading-relaxed">{summaryDraft}</div>
            </div>
          )}

          {/* Flows */}
          {flowsDraft && (
            <div className="p-4 rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)] mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Flows</span>
                <span className="text-[10px] text-green-600 font-semibold">Auto-included</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[12px] text-[var(--text-primary)]">
                <div><span className="font-semibold text-green-700">EQ Buy:</span> {flowsDraft.eqBuyer}</div>
                <div><span className="font-semibold text-red-600">EQ Sell:</span> {flowsDraft.eqSeller}</div>
                <div><span className="font-semibold text-green-700">FI Buy:</span> {flowsDraft.fiBuyer}</div>
                <div><span className="font-semibold text-red-600">FI Sell:</span> {flowsDraft.fiSeller}</div>
              </div>
            </div>
          )}

          {/* Individual blocks */}
          {draft.map((block) => (
            <div
              key={block.id}
              className={`p-4 rounded-lg border mb-3 transition-all duration-200 ${
                block.accepted ? "border-green-400 bg-green-50" :
                block.rejected ? "border-red-300 bg-red-50 opacity-50" :
                "border-[var(--border-light)] bg-[var(--bg-card)]"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#8b5cf6" }}>{block.section}</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => toggleBlock(block.id, "accept")}
                    className={`px-3 py-1 rounded text-[10px] font-bold border cursor-pointer ${
                      block.accepted ? "bg-green-600 text-white border-green-600" : "bg-transparent text-green-600 border-green-400"
                    }`}
                  >
                    {block.accepted ? "\u2713 Accepted" : "Accept"}
                  </button>
                  <button
                    onClick={() => toggleBlock(block.id, "reject")}
                    className={`px-3 py-1 rounded text-[10px] font-bold border cursor-pointer ${
                      block.rejected ? "bg-red-500 text-white border-red-500" : "bg-transparent text-red-500 border-red-300"
                    }`}
                  >
                    {block.rejected ? "\u2717 Rejected" : "Skip"}
                  </button>
                </div>
              </div>

              {block.title && <div className="text-[13px] font-bold text-[var(--text-primary)] uppercase mb-1">{block.title}</div>}
              {block.ticker && <div className="text-[13px] font-bold text-[var(--text-primary)] mb-1">{block.ticker}</div>}
              {block.idea && <div className="text-[13px] font-bold text-[var(--text-primary)] mb-1">{block.idea}</div>}
              {block.body && <div className="text-[13px] text-[var(--text-secondary)] leading-relaxed text-justify">{block.body}</div>}
              {block.reason && <div className="text-[12px] text-[var(--text-muted)] italic mt-1">{block.reason}</div>}
              {block.lsPick && <div className="text-[12px] text-green-700 mt-2 p-2 bg-green-50 rounded border-l-3 border-green-500"><strong>LS View:</strong> {block.lsPick}</div>}
            </div>
          ))}

          {/* Apply button */}
          <div className="flex gap-3 items-center p-4 rounded-lg border border-[var(--border-light)] bg-[var(--bg-card)]">
            <button
              onClick={handleApply}
              disabled={acceptedCount === 0 && !summaryDraft}
              className="flex-1 py-3 rounded-md border-none text-white text-sm font-bold cursor-pointer uppercase disabled:opacity-50"
              style={{ background: acceptedCount > 0 || summaryDraft ? BRAND.blue : "#999" }}
            >
              Apply {acceptedCount} accepted item{acceptedCount !== 1 ? "s" : ""} to Daily
            </button>
            <button
              onClick={() => { draft.forEach((b) => toggleBlock(b.id, "accept")); }}
              className="px-4 py-3 rounded-md border border-green-400 bg-transparent text-green-600 text-xs font-bold cursor-pointer"
            >
              Accept All
            </button>
            <button
              onClick={() => { setDraft([]); setSummaryDraft(""); setFlowsDraft(null); setGenerated(false); }}
              className="px-4 py-3 rounded-md border border-[var(--border-input)] bg-transparent text-[var(--text-muted)] text-xs font-bold cursor-pointer"
            >
              Discard
            </button>
          </div>
        </>
      )}
    </div>
  );
}
