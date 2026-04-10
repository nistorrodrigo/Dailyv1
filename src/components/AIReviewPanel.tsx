import React, { useState } from "react";
import { BRAND } from "../constants/brand";
import useDailyStore from "../store/useDailyStore";
import AIModelPicker, { type AIModelKey, AI_MODELS } from "./ui/AIModelPicker";
import { generateBBG } from "../utils/generateBBG";

interface ReviewResult {
  issues: string[];
  suggestions: string[];
  score: number;
  summary: string;
  tokens: number;
  model: string;
}

export default function AIReviewPanel({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactElement | null {
  const [model, setModel] = useState<AIModelKey>("haiku");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [execSummary, setExecSummary] = useState("");

  if (!open) return null;

  const selectedModel = AI_MODELS.find(m => m.key === model)!;

  const handleReview = async () => {
    setLoading(true);
    setResult(null);
    try {
      const state = useDailyStore.getState();
      const bbg = generateBBG(state);

      const resp = await fetch("/api/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: `REVIEW this Argentina Daily report for quality before sending. Check for:
1. Inconsistencies (contradicting statements between sections)
2. Missing data (empty sections that are toggled on, missing prices)
3. Typos or grammatical errors
4. Stale/outdated information
5. Professional tone and clarity

Also generate a 2-3 sentence EXECUTIVE SUMMARY of the entire daily.

The daily content:
${bbg}

Return a JSON object:
{
  "score": 1-10 quality score,
  "issues": ["issue 1", "issue 2"],
  "suggestions": ["suggestion 1"],
  "summary": "2-3 sentence executive summary of the daily"
}

Return ONLY the JSON, no markdown.`,
          date: state.date,
          model,
          mode: "macro",
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);

      const text = data.blocks?.[0]?.body || data.blocks?.[0]?.title || "{}";
      let parsed: Partial<ReviewResult>;
      try {
        const clean = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(clean);
      } catch {
        parsed = { score: 7, issues: [], suggestions: [text], summary: "" };
      }

      const tokens = (data.usage?.input || 0) + (data.usage?.output || 0);
      setResult({
        score: parsed.score || 7,
        issues: parsed.issues || [],
        suggestions: parsed.suggestions || [],
        summary: parsed.summary || "",
        tokens,
        model: data.model || model,
      });
      if (parsed.summary) setExecSummary(parsed.summary);
    } catch (err) {
      alert("Review failed: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const applySummary = () => {
    if (execSummary) {
      useDailyStore.getState().setField("summaryBar", execSummary);
      alert("Executive summary applied to Summary Bar!");
    }
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 w-[440px] bg-[var(--bg-card)] shadow-[var(--shadow-panel)] z-[1000] flex flex-col panel-slide">
      <div className="flex justify-between items-center px-5 py-4" style={{ background: BRAND.navy }}>
        <span className="text-white text-sm font-bold uppercase tracking-wider">AI Review</span>
        <button onClick={onClose} className="bg-transparent border-none text-[var(--color-sky)] text-xl cursor-pointer">{"\u00D7"}</button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <p className="text-xs text-[var(--text-muted)] mb-4">
          AI reviews your daily for consistency, typos, missing data, and generates an executive summary.
        </p>

        <div className="mb-4">
          <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Model</label>
          <AIModelPicker value={model} onChange={setModel} />
          <div className="text-[10px] text-[var(--text-muted)] mt-1">Estimated cost: ~{selectedModel.costLabel}/review</div>
        </div>

        <button
          onClick={handleReview}
          disabled={loading}
          className="w-full py-3 rounded-md border-none text-white text-sm font-bold cursor-pointer uppercase disabled:opacity-50 mb-4"
          style={{ background: loading ? "#999" : "#8b5cf6" }}
        >
          {loading ? "Reviewing..." : "Review Daily Before Send"}
        </button>

        {result && (
          <>
            {/* Score */}
            <div className="flex items-center gap-3 mb-4 p-3 rounded-md border border-[var(--border-light)] bg-[var(--bg-card-alt)]">
              <div className={`text-3xl font-light ${result.score >= 8 ? "text-green-600" : result.score >= 5 ? "text-amber-500" : "text-red-500"}`}>
                {result.score}/10
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--text-primary)]">Quality Score</div>
                <div className="text-[10px] text-[var(--text-muted)]">{result.tokens} tokens · {result.model}</div>
              </div>
            </div>

            {/* Issues */}
            {result.issues.length > 0 && (
              <div className="mb-4">
                <div className="text-[11px] font-bold text-red-500 uppercase tracking-wide mb-2">Issues Found</div>
                {result.issues.map((issue, i) => (
                  <div key={i} className="flex gap-2 mb-1.5 text-xs text-[var(--text-primary)]">
                    <span className="text-red-500 flex-shrink-0">&#9679;</span>
                    <span>{issue}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Suggestions */}
            {result.suggestions.length > 0 && (
              <div className="mb-4">
                <div className="text-[11px] font-bold text-amber-500 uppercase tracking-wide mb-2">Suggestions</div>
                {result.suggestions.map((s, i) => (
                  <div key={i} className="flex gap-2 mb-1.5 text-xs text-[var(--text-primary)]">
                    <span className="text-amber-500 flex-shrink-0">&#9679;</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            )}

            {result.issues.length === 0 && result.suggestions.length === 0 && (
              <div className="mb-4 p-3 rounded-md bg-green-50 border border-green-200 text-sm text-green-700 font-semibold">
                No issues found. Daily looks good to send!
              </div>
            )}

            {/* Executive Summary */}
            {result.summary && (
              <div className="mb-4 p-3 rounded-md border border-[var(--border-light)] bg-[var(--bg-card-alt)]">
                <div className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wide mb-2">Executive Summary</div>
                <div className="text-[13px] text-[var(--text-primary)] leading-relaxed mb-2">{result.summary}</div>
                <button
                  onClick={applySummary}
                  className="px-3 py-1.5 rounded text-[10px] font-bold border cursor-pointer"
                  style={{ borderColor: BRAND.blue, color: BRAND.blue, background: "transparent" }}
                >
                  Apply as Summary Bar
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
