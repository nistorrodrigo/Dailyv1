import React from "react";

/**
 * Single source of truth for the Claude model catalogue used across the
 * AI panels (AI Review, AI Draft, MacroSection's "expand block with AI").
 * Pricing reflects the Anthropic API rate card as of 2026-04 — see
 * https://docs.claude.com/en/docs/about-claude/models/overview.
 *
 * `pricePerMTok` is the canonical input/output rate in USD per million
 * tokens; `costLabel` is the rough per-call estimate the picker shows
 * to the analyst (covers either a Draft or a Review with the prompt
 * sizes we currently send — input ~1.5k tokens, output ~1k tokens).
 *
 * Tiers, in order of capability and cost:
 *   - Haiku  4.5: fastest, cheapest. Good for AI Review where the JSON
 *                 contract is strict and the rubric does most of the work.
 *   - Sonnet 4.6: balanced. Good default for AI Draft when you want
 *                 better narrative judgement than Haiku.
 *   - Opus   4.7: most capable. Use when you want the model to push
 *                 back on subtle inconsistencies or compose the most
 *                 polished prose. ~5x the price of Haiku.
 *
 * If a new model lands, only this constant needs to change — both the
 * picker and the consuming Sections derive from it. The backend
 * `api/ai-draft.js` keeps its own MODELS map (kept in sync manually
 * because the api/ dir is plain JS and can't import from src/).
 */
export const AI_MODELS = [
  {
    key: "haiku",
    label: "Haiku 4.5",
    pricePerMTok: { input: 1, output: 5 },
    costLabel: "~$0.01",
  },
  {
    key: "sonnet",
    label: "Sonnet 4.6",
    pricePerMTok: { input: 3, output: 15 },
    costLabel: "~$0.03",
  },
  {
    key: "opus",
    label: "Opus 4.7",
    pricePerMTok: { input: 5, output: 25 },
    costLabel: "~$0.05",
  },
] as const;

export type AIModelKey = typeof AI_MODELS[number]["key"];

/**
 * Compute the actual USD cost of a single API call given the realised
 * input/output token counts. The picker's `costLabel` is a rough
 * pre-flight estimate; this is the post-flight precise figure usable
 * in result panels ("this review cost you $0.0072").
 */
export function estimateCost(modelKey: AIModelKey, inputTokens: number, outputTokens: number): number {
  const m = AI_MODELS.find((x) => x.key === modelKey);
  if (!m) return 0;
  return (inputTokens * m.pricePerMTok.input) / 1_000_000 + (outputTokens * m.pricePerMTok.output) / 1_000_000;
}

interface AIModelPickerProps {
  value: AIModelKey;
  onChange: (model: AIModelKey) => void;
  compact?: boolean;
}

export default function AIModelPicker({ value, onChange, compact = false }: AIModelPickerProps): React.ReactElement {
  const selected = AI_MODELS.find(m => m.key === value) || AI_MODELS[0];

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <select
          value={value}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value as AIModelKey)}
          className="themed-input px-2 py-1 rounded border border-[var(--border-input)] text-[10px] font-bold bg-[var(--bg-input)] text-[var(--text-primary)]"
        >
          {AI_MODELS.map(m => (
            <option key={m.key} value={m.key}>{m.label} ({m.costLabel})</option>
          ))}
        </select>
        <span className="text-[9px] text-[var(--text-muted)]">{selected.costLabel}/call</span>
      </div>
    );
  }

  return (
    <div className="flex gap-1.5">
      {AI_MODELS.map(m => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={`flex-1 py-2 rounded-md text-[10px] font-bold border cursor-pointer ${
            value === m.key ? "text-white" : "border-[var(--border-input)] text-[var(--text-muted)] bg-transparent"
          }`}
          style={value === m.key ? { background: "#8b5cf6", borderColor: "#8b5cf6" } : {}}
        >
          {m.label} <span className="font-normal opacity-70">{m.costLabel}</span>
        </button>
      ))}
    </div>
  );
}
