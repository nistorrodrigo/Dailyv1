import React, { useState } from "react";
import { BRAND } from "../constants/brand";
import useDailyStore from "../store/useDailyStore";
import AIModelPicker, { type AIModelKey, AI_MODELS } from "./ui/AIModelPicker";
import { generateBBG } from "../utils/generateBBG";
import { toast } from "../store/useToastStore";

interface ReviewResult {
  /** Quality score 1–10. `null` only when the model failed to return
   *  parseable JSON, in which case the recovery path stuffs raw text
   *  into `suggestions` and the panel hides the score chip. */
  score: number | null;
  issues: string[];
  suggestions: string[];
  /** Specific actionable changes that would bring the score to 10.
   *  Empty when the score is already 10 — or when the model didn't
   *  populate it (older deploys missing this field). */
  whatNeededFor10: string[];
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

      // Use the dedicated `mode: "review"` endpoint path. The server
      // wires up the right system prompt (editor/risk-officer, not
      // writer), enforces the JSON contract, and returns the parsed
      // review object directly under `data.review` — no more digging
      // through `blocks[0].body` and re-parsing.
      const resp = await fetch("/api/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "review",
          dailyText: bbg,
          date: state.date,
          model,
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);

      const review = data.review || {};
      const tokens = (data.usage?.input || 0) + (data.usage?.output || 0);
      setResult({
        score: typeof review.score === "number" ? review.score : null,
        issues: Array.isArray(review.issues) ? review.issues : [],
        suggestions: Array.isArray(review.suggestions) ? review.suggestions : [],
        whatNeededFor10: Array.isArray(review.whatNeededFor10) ? review.whatNeededFor10 : [],
        summary: review.summary || "",
        tokens,
        model: data.model || model,
      });
      if (review.summary) setExecSummary(review.summary);
    } catch (err) {
      toast.error("Review failed: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const applySummary = () => {
    if (execSummary) {
      useDailyStore.getState().setField("summaryBar", execSummary);
      toast.success("Executive summary applied to Summary Bar");
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
            {/* Score — hidden when null (model returned unparseable text;
                recovery path stuffed it into suggestions instead). */}
            {result.score !== null && (
              <div className="flex items-center gap-3 mb-4 p-3 rounded-md border border-[var(--border-light)] bg-[var(--bg-card-alt)]">
                <div className={`text-3xl font-light ${result.score >= 8 ? "text-green-600" : result.score >= 5 ? "text-amber-500" : "text-red-500"}`}>
                  {result.score}/10
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">Quality Score</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{result.tokens} tokens · {result.model}</div>
                </div>
              </div>
            )}

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

            {/* What's needed for a 10 — only shown when the score is below 10
                and the model populated the list. This is the actionable
                checklist the analyst can run through to ship a perfect
                daily. */}
            {result.whatNeededFor10.length > 0 && (
              <div
                className="mb-4 p-3 rounded-md"
                style={{
                  background: "rgba(139,92,246,0.08)",
                  border: "1px solid rgba(139,92,246,0.3)",
                }}
              >
                <div className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: "#8b5cf6" }}>
                  To reach 10/10
                </div>
                {result.whatNeededFor10.map((item, i) => (
                  <div key={i} className="flex gap-2 mb-1.5 text-xs text-[var(--text-primary)]">
                    <span className="flex-shrink-0 font-bold" style={{ color: "#8b5cf6" }}>{i + 1}.</span>
                    <span>{item}</span>
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

            {result.issues.length === 0 &&
              result.suggestions.length === 0 &&
              result.whatNeededFor10.length === 0 && (
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
