import React, { useEffect, useState } from "react";
import { BRAND } from "../constants/brand";
import useDailyStore from "../store/useDailyStore";
import useUIStore from "../store/useUIStore";
import AIModelPicker, { type AIModelKey, AI_MODELS, estimateCost } from "./ui/AIModelPicker";
import { generateBBG } from "../utils/generateBBG";
import { preflightReview } from "../utils/preflightReview";
import { buildExternalReviewPrompt } from "../utils/externalReviewPrompt";
import { toast } from "../store/useToastStore";
import { authedFetch } from "../lib/authedFetch";

/** A single "to reach 10/10" item. The model returns these as objects
 *  with both the human-readable instruction and a section key the UI
 *  can deep-link to. Strings are accepted for backwards compat with
 *  responses generated before the structured shape rolled out. */
interface NeededItem {
  text: string;
  /** Section key matching the editor anchors (`section-${key}`).
   *  Optional — old responses just have free-form text; new ones tag
   *  every item so the panel can render a Jump button. */
  targetSection?: string;
}

/** Normalize whatNeededFor10 from either the legacy flat-string shape
 *  or the new structured shape into the `NeededItem` union. Defensive
 *  against partial / repaired JSON. */
function normalizeNeededItems(raw: unknown): NeededItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): NeededItem | null => {
      if (typeof item === "string") return { text: item };
      if (item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string") {
        const obj = item as { text: string; targetSection?: unknown };
        return {
          text: obj.text,
          targetSection: typeof obj.targetSection === "string" ? obj.targetSection : undefined,
        };
      }
      return null;
    })
    .filter((x): x is NeededItem => x !== null);
}

/** Map a section key returned by the AI to the editor's DOM anchor id.
 *  Most keys map 1-to-1 to `section-<key>`; a few aliases land on
 *  general anchors so the analyst still gets scrolled somewhere
 *  reasonable when the AI picks an unusual target. */
function anchorForSection(key: string | undefined): string | null {
  if (!key) return null;
  const aliases: Record<string, string> = {
    headline: "section-general",
    summaryBar: "section-general",
    general: "section-general",
    signatures: "section-signatures",
  };
  return aliases[key] || `section-${key}`;
}

interface ReviewResult {
  /** Quality score 1–10. `null` only when the model failed to return
   *  parseable JSON, in which case the recovery path stuffs raw text
   *  into `suggestions` and the panel hides the score chip. */
  score: number | null;
  issues: string[];
  suggestions: string[];
  /** Specific actionable changes that would bring the score to 10.
   *  Empty when the score is already 10 — or when the model didn't
   *  populate it (older deploys missing this field). Items may be
   *  flat strings (legacy) or `{text, targetSection}` (new). */
  whatNeededFor10: NeededItem[];
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

// Score-delta badge palette. Keyed by tone bucket (improvement /
// regression / unchanged) so the JSX picks the styles by name
// instead of carrying a 6-way ternary tower inline.
const DELTA_STYLES: Record<"up" | "down" | "flat", { background: string; color: string }> = {
  up: { background: "rgba(16,185,129,0.15)", color: "#059669" },
  down: { background: "rgba(239,68,68,0.15)", color: "#dc2626" },
  flat: { background: "rgba(148,163,184,0.15)", color: "#64748b" },
};

export default function AIReviewPanel({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactElement | null {
  const setTab = useUIStore((s) => s.setTab);

  // Switch to the Editor tab and scroll to the right section anchor.
  // Same scroll-with-highlight pattern WorkflowPanel uses, kept inline
  // here rather than factored out — the shared helper would have to
  // know about `setTab` from a different store and there are only
  // two callers today.
  const goToSection = (anchorId: string): void => {
    setTab("edit");
    onClose();
    requestAnimationFrame(() => {
      const el = document.getElementById(anchorId);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.style.transition = "box-shadow 200ms ease";
      el.style.boxShadow = `0 0 0 3px ${BRAND.sky}`;
      setTimeout(() => {
        el.style.boxShadow = "";
      }, 1200);
    });
  };

  // Default to Sonnet 4.6 — the review prompt benefits noticeably from
  // sonnet's stronger judgement over haiku's speed (better at spotting
  // subtle inconsistencies, less prone to vague "could be tightened"
  // feedback). The cost gap is ~$0.02/call which is trivial vs. the
  // editorial value at the desk's send cadence.
  const [model, setModel] = useState<AIModelKey>("sonnet");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [execSummary, setExecSummary] = useState("");
  // Per-review tick state for the "To reach 10/10" items. When the
  // analyst marks an item as addressed, the index goes true. Reset
  // whenever a new review lands — the previous tick state is for a
  // stale list of items. Drives the "X/N addressed" progress + the
  // re-run nudge that lights up when everything is checked.
  const [addressed, setAddressed] = useState<boolean[]>([]);
  // Score from the previous review run in this session. Used to
  // render a delta badge ("+2 from previous") so the analyst can
  // see whether their refinement pass actually moved the needle.
  // null until the second review of the session.
  const [previousScore, setPreviousScore] = useState<number | null>(null);
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
  // True when the analyst has ticked every "To reach 10/10" item the
  // last review surfaced. Drives both the progress counter and the
  // re-run nudge — the analyst is signalling "I addressed everything,
  // now grade me again." Guarded against empty lists so a perfect
  // daily (no items) doesn't spuriously light up the re-run CTA.
  const addressedCount = addressed.filter(Boolean).length;
  const totalToAddress = result?.whatNeededFor10.length ?? 0;
  const allAddressed = totalToAddress > 0 && addressedCount === totalToAddress;
  // Delta vs. the previous review run in this session. Only meaningful
  // when both scores are present; rendered as +N / -N / ±0 badge next
  // to the score chip so the analyst can see the refinement actually
  // moved the needle.
  const scoreDelta = result?.score != null && previousScore != null ? result.score - previousScore : null;

  // Tone bucket for the delta badge — improvement / regression /
  // unchanged. Indexed into the `DELTA_STYLES` lookup below to avoid
  // a tower of ternaries inside the JSX.
  const deltaTone: "up" | "down" | "flat" | null =
    scoreDelta == null ? null : scoreDelta > 0 ? "up" : scoreDelta < 0 ? "down" : "flat";

  // Pick the main CTA label. Priority: in-flight > "ready to re-grade"
  // (all items ticked) > already-reviewed > preflight escape hatch >
  // first run. Pulled out of JSX to keep the render readable.
  const reviewButtonLabel = loading
    ? "Reviewing..."
    : allAddressed
      ? "Re-run AI Review"
      : result
        ? "Re-review Daily"
        : tooManyPreflightIssues
          ? "Run AI Review Anyway"
          : "Review Daily Before Send";

  const handleReview = async () => {
    // Snapshot the current score before we wipe `result` for the new
    // run — the panel uses this to render "+2 from previous" once
    // the new review lands. Skips when there's no previous result
    // yet (first review of the session).
    if (result?.score != null) {
      setPreviousScore(result.score);
    }
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
      const whatNeededFor10 = normalizeNeededItems(review.whatNeededFor10);
      setResult({
        score: typeof review.score === "number" ? review.score : null,
        issues: Array.isArray(review.issues) ? review.issues : [],
        suggestions: Array.isArray(review.suggestions) ? review.suggestions : [],
        whatNeededFor10,
        summary: review.summary || "",
        tokens: inputTokens + outputTokens,
        cost: estimateCost(model, inputTokens, outputTokens),
        model: data.model || model,
        truncated: Boolean(data.truncated),
        parseRecovered: Boolean(data.parseRecovered),
      });
      // Reset the per-item tick state to match the new list — the
      // previous run's checks belong to a stale list of items.
      setAddressed(new Array(whatNeededFor10.length).fill(false));
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

  // Copy a self-contained review prompt + the BBG-format daily into
  // the clipboard. The analyst then pastes into ChatGPT / Claude /
  // Gemini directly — frontier-tier model of their choice, no extra
  // API spend, longer context, free-form follow-up. Faster path
  // when the in-app review feels stale or the daily is long.
  const handleCopyPrompt = async (): Promise<void> => {
    try {
      const prompt = buildExternalReviewPrompt(useDailyStore.getState());
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt copied — paste into ChatGPT or Claude");
    } catch (err) {
      toast.error("Couldn't copy: " + (err as Error).message);
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
          Copies a review prompt + your daily to the clipboard — paste into
          ChatGPT, Claude, or Gemini. You get back specific fixes (with
          replacement text) and a one-line executive summary for the
          Summary Bar.
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

        {/* Primary CTA — copies a self-contained prompt + the daily
            into the clipboard so the analyst can paste into the
            chat of their choice (ChatGPT, Claude, Gemini) and get
            issues + executive summary back. Frontier-tier model,
            no API spend, full free-form follow-up. */}
        <button
          onClick={handleCopyPrompt}
          className="w-full py-3 rounded-md border-none text-white text-sm font-bold cursor-pointer uppercase mb-2"
          style={{ background: "#1e5ab0" }}
          title="Copy a ready-to-paste review prompt + your daily into the clipboard"
        >
          ⎘ Copy review prompt for ChatGPT / Claude
        </button>
        <div className="mb-4 text-[10px] text-[var(--text-muted)] leading-relaxed">
          Paste into your chat. The reply will list specific fixes
          with replacement text and a 120-char executive summary you
          can drop into the Summary Bar.
        </div>

        {/* Secondary path: in-app API review. Same JSON-contract
            review the panel always shipped, kept here for the
            workflow with the checkable "to reach 10/10" list and
            the score-delta tracking. The copy-prompt button above
            is faster + uses better models when the analyst already
            has a chat tab open. */}
        <details className="mb-4">
          <summary className="cursor-pointer text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide">
            Or run in-app review (slower, fixed prompt)
          </summary>
          <div className="mt-3">
            <label className="block mb-1 text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Model</label>
            <AIModelPicker value={model} onChange={setModel} />
            <div className="text-[10px] text-[var(--text-muted)] mt-1 mb-3">Estimated cost: ~{selectedModel.costLabel}/review</div>
            <button
              onClick={handleReview}
              disabled={loading}
              className="w-full py-2.5 rounded-md border-none text-white text-xs font-bold cursor-pointer uppercase disabled:opacity-50"
              style={{
                background: loading ? "#999" : allAddressed ? "#10b981" : "#8b5cf6",
              }}
              title={
                allAddressed
                  ? "Re-grade after addressing all the items above"
                  : tooManyPreflightIssues
                    ? "Recommended: fix the quick-check items above first"
                    : undefined
              }
            >
              {reviewButtonLabel}
            </button>
            {tooManyPreflightIssues && !loading && (
              <div className="mt-2 text-[10px] text-[var(--text-muted)] text-center italic">
                Tip: fixing the {preflightIssues.length} items above first makes the AI feedback more useful (and saves a call).
              </div>
            )}
          </div>
        </details>

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
                {/* Delta badge — present from the second review onward
                    in a session. Green for improvement, red for
                    regression, neutral for no change. Helps the
                    analyst see the refinement loop is working. */}
                {scoreDelta !== null && deltaTone !== null && (
                  <div
                    className="px-2 py-0.5 rounded text-[11px] font-bold"
                    style={DELTA_STYLES[deltaTone]}
                    title={`Previous review: ${previousScore}/10`}
                  >
                    {scoreDelta > 0 ? "+" : ""}
                    {scoreDelta} from previous
                  </div>
                )}
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
                and the model populated the list. Items are checkable
                buttons so the analyst can tick them off as they
                address each one. When all are checked, the main CTA
                turns green and prompts a re-review to grade the
                refinement. */}
            {result.whatNeededFor10.length > 0 && (
              <div
                className="mb-4 p-3 rounded-md"
                style={{
                  background: "rgba(139,92,246,0.08)",
                  border: "1px solid rgba(139,92,246,0.3)",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#8b5cf6" }}>
                    To reach 10/10
                  </div>
                  <div className="text-[10px] font-semibold text-[var(--text-muted)]">
                    {addressedCount}/{totalToAddress} addressed
                  </div>
                </div>
                {result.whatNeededFor10.map((item, i) => {
                  const done = addressed[i] === true;
                  const anchor = anchorForSection(item.targetSection);
                  return (
                    <div key={i} className="flex items-start gap-2 mb-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setAddressed((prev) => {
                            const next = [...prev];
                            next[i] = !next[i];
                            return next;
                          })
                        }
                        className="flex items-start gap-2 flex-1 text-left text-xs cursor-pointer bg-transparent border-none p-0"
                        style={{
                          color: done ? "var(--text-muted)" : "var(--text-primary)",
                          textDecoration: done ? "line-through" : "none",
                        }}
                      >
                        <span
                          className="flex-shrink-0 inline-flex items-center justify-center w-4 h-4 rounded border text-[10px] font-bold mt-[1px]"
                          style={{
                            borderColor: "#8b5cf6",
                            background: done ? "#8b5cf6" : "transparent",
                            color: done ? "white" : "#8b5cf6",
                          }}
                        >
                          {done ? "✓" : i + 1}
                        </span>
                        <span>{item.text}</span>
                      </button>
                      {/* Jump-to-section button — closes the panel,
                          switches to the Editor tab, scrolls + flashes
                          the target section. Hidden when the AI didn't
                          tag a target (legacy responses) or it's
                          already addressed. */}
                      {anchor && !done && (
                        <button
                          type="button"
                          onClick={() => goToSection(anchor)}
                          title={`Jump to ${item.targetSection ?? "section"} in the editor`}
                          className="flex-shrink-0 text-[10px] font-bold border-none cursor-pointer rounded px-2 py-0.5 mt-[1px]"
                          style={{
                            background: "rgba(139,92,246,0.15)",
                            color: "#8b5cf6",
                          }}
                        >
                          Jump →
                        </button>
                      )}
                    </div>
                  );
                })}
                {allAddressed && (
                  <div className="mt-2 text-[11px] font-semibold" style={{ color: "#059669" }}>
                    All addressed — re-run the review to grade your refinement.
                  </div>
                )}
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
