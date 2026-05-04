import React, { useEffect, useState } from "react";
import { BRAND } from "../constants/brand";
import useDailyStore from "../store/useDailyStore";
import AIModelPicker, { type AIModelKey, AI_MODELS, estimateCost } from "./ui/AIModelPicker";
import { generateBBG } from "../utils/generateBBG";
import { preflightReview } from "../utils/preflightReview";
import { toast } from "../store/useToastStore";
import { authedFetch } from "../lib/authedFetch";

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
  /** Combined input + output tokens, for the cost line. */
  tokens: number;
  /** Computed actual USD cost from the input/output token split, using
   *  the rate card in AIModelPicker.AI_MODELS. */
  cost: number;
  model: string;
  /** Server hit `max_tokens` — the response is a best-effort recovery
   *  of a truncated JSON object. Trailing fields (typically `summary`
   *  or the tail of `whatNeededFor10`) may be missing or cut short. */
  truncated: boolean;
  /** JSON.parse failed but jsonrepair salvaged a usable object. When
   *  true, treat fields as approximate; structure may be irregular. */
  parseRecovered: boolean;
}

export default function AIReviewPanel({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactElement | null {
  // Default to Sonnet 4.6 — the review prompt benefits noticeably from
  // sonnet's stronger judgement over haiku's speed (better at spotting
  // subtle inconsistencies, less prone to vague "could be tightened"
  // feedback). The cost gap is ~$0.02/call which is trivial vs. the
  // editorial value at the desk's send cadence.
  const [model, setModel] = useState<AIModelKey>("sonnet");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [execSummary, setExecSummary] = useState("");
  // Preflight issues found locally without an API call. Cleared on
  // open and after a successful review. If non-empty, we surface them
  // above the "Review" button as a chance for the analyst to fix
  // before paying for an LLM round-trip.
  const [preflightIssues, setPreflightIssues] = useState<string[]>([]);
  // Threshold above which we suggest fixing locally first before
  // running AI. 3 chosen as a balance — under that, the daily is
  // probably "mostly there" and the AI can still add value finding
  // subtler issues; above that, AI feedback gets diluted.
  const PREFLIGHT_BLOCK_THRESHOLD = 3;

  // Run the local preflight scan on every open and re-run it whenever
  // the user clicks "Re-check". Cheap (synchronous, no API call) so we
  // do it eagerly rather than deferring to an explicit user action.
  const runPreflight = () => {
    const state = useDailyStore.getState();
    setPreflightIssues(preflightReview(state));
  };
  useEffect(() => {
    if (open) runPreflight();
  }, [open]);

  if (!open) return null;

  const selectedModel = AI_MODELS.find(m => m.key === model)!;
  const tooManyPreflightIssues = preflightIssues.length >= PREFLIGHT_BLOCK_THRESHOLD;

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
      const resp = await authedFetch("/api/ai-draft", {
        method: "POST",
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
      const inputTokens = data.usage?.input || 0;
      const outputTokens = data.usage?.output || 0;
      setResult({
        score: typeof review.score === "number" ? review.score : null,
        issues: Array.isArray(review.issues) ? review.issues : [],
        suggestions: Array.isArray(review.suggestions) ? review.suggestions : [],
        whatNeededFor10: Array.isArray(review.whatNeededFor10) ? review.whatNeededFor10 : [],
        summary: review.summary || "",
        tokens: inputTokens + outputTokens,
        cost: estimateCost(model, inputTokens, outputTokens),
        model: data.model || model,
        truncated: Boolean(data.truncated),
        parseRecovered: Boolean(data.parseRecovered),
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

        {/* Local pre-flight checks — run synchronously, no API call.
            Catches the obvious "toggled on but empty" gaps that an
            analyst can fix in 30 seconds without spending tokens. */}
        <div className="mb-4 p-3 rounded-md border border-[var(--border-light)] bg-[var(--bg-card-alt)]">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">
              Quick checks <span className="text-[var(--text-muted)] font-normal normal-case">(no API call)</span>
            </div>
            <button
              onClick={runPreflight}
              className="bg-transparent border-none text-[10px] font-semibold text-[var(--color-sky)] cursor-pointer"
              title="Re-run after fixing items"
            >
              Re-check
            </button>
          </div>
          {preflightIssues.length === 0 ? (
            <div className="text-[12px] text-green-600 font-semibold">
              ✓ No obvious gaps. Daily looks structurally complete.
            </div>
          ) : (
            <>
              <div className="text-[11px] text-[var(--text-muted)] mb-2">
                Found {preflightIssues.length} item{preflightIssues.length === 1 ? "" : "s"} you can fix without AI:
              </div>
              {preflightIssues.map((msg, i) => (
                <div key={i} className="flex gap-2 mb-1 text-[12px] text-[var(--text-primary)]">
                  <span className="text-amber-500 flex-shrink-0">⚠</span>
                  <span>{msg}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="mb-4">
          <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Model</label>
          <AIModelPicker value={model} onChange={setModel} />
          <div className="text-[10px] text-[var(--text-muted)] mt-1">Estimated cost: ~{selectedModel.costLabel}/review</div>
        </div>

        <button
          onClick={handleReview}
          disabled={loading}
          className="w-full py-3 rounded-md border-none text-white text-sm font-bold cursor-pointer uppercase disabled:opacity-50 mb-2"
          style={{ background: loading ? "#999" : "#8b5cf6" }}
          title={tooManyPreflightIssues ? "Recommended: fix the quick-check items above first" : undefined}
        >
          {loading
            ? "Reviewing..."
            : tooManyPreflightIssues
              ? "Run AI Review Anyway"
              : "Review Daily Before Send"}
        </button>
        {tooManyPreflightIssues && !loading && (
          <div className="mb-4 text-[10px] text-[var(--text-muted)] text-center italic">
            Tip: fixing the {preflightIssues.length} items above first makes the AI feedback more useful (and saves a call).
          </div>
        )}

        {result && (
          <>
            {/* Truncation banner — fires when the model hit max_tokens
                (`truncated`) or jsonrepair had to salvage a partial
                response (`parseRecovered`). Trailing fields may be
                missing or cut short. Surfacing it here lets the
                analyst know to either upgrade to Opus 4.7 or shorten
                the daily, rather than silently trusting an incomplete
                review. */}
            {(result.truncated || result.parseRecovered) && (
              <div
                className="mb-3 p-3 rounded-md text-[12px]"
                style={{
                  background: "rgba(231,158,76,0.12)",
                  color: "#c97a2c",
                  border: "1px solid rgba(231,158,76,0.45)",
                }}
              >
                <div className="font-bold mb-1">⚠ Response was incomplete</div>
                <div className="text-[11px]" style={{ color: "var(--text-primary)" }}>
                  {result.truncated
                    ? "The model hit its output token limit before finishing. "
                    : "The JSON came back malformed and was repaired. "}
                  Trailing fields may be cut short. Try Opus 4.7 (more headroom) or shorten the daily before re-running.
                </div>
              </div>
            )}

            {/* Score — hidden when null (model returned unparseable text;
                recovery path stuffed it into suggestions instead). */}
            {result.score !== null && (
              <div className="flex items-center gap-3 mb-4 p-3 rounded-md border border-[var(--border-light)] bg-[var(--bg-card-alt)]">
                <div className={`text-3xl font-light ${result.score >= 8 ? "text-green-600" : result.score >= 5 ? "text-amber-500" : "text-red-500"}`}>
                  {result.score}/10
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">Quality Score</div>
                  <div className="text-[10px] text-[var(--text-muted)]">
                    {result.tokens.toLocaleString()} tokens · {result.model}
                    {result.cost > 0 && <> · ${result.cost.toFixed(4)}</>}
                  </div>
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
