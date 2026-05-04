import React, { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../../store/useDailyStore";
import { Card, Inp } from "../ui";
import { BRAND } from "../../constants/brand";
import { authedFetch } from "../../lib/authedFetch";
import { findMostRecentDailyBefore } from "../../lib/dailyApi";
import { todayLocal } from "../../utils/dates";
import { generateBBG } from "../../utils/generateBBG";
import { toast } from "../../store/useToastStore";
import AIModelPicker, { type AIModelKey, AI_MODELS, estimateCost } from "../ui/AIModelPicker";

/**
 * Yesterday-in-Review — short prose at the top of the daily that
 * scores the desk's prior-day calls against today's price action.
 * The institutional-credibility play: foreign PMs and traders
 * forward the dailies that are publicly honest about misses.
 *
 * Two paths to populate the body:
 *
 *   1. **Generate with AI** — pulls yesterday's daily from Supabase
 *      via `findMostRecentDailyBefore` (same calendar-walking helper
 *      the carry-forward button uses), feeds it + today's snapshot to
 *      the AI Draft endpoint with `mode: "yesterday-recap"`. Model
 *      writes 3-5 sentences in the institutional register the system
 *      prompt enforces.
 *
 *   2. **Manual edit** — the textarea is always editable. The AI
 *      output is a starting point, never the final word; the analyst
 *      knows context the model doesn't (intraday flow, client
 *      conversations, calendar awareness).
 */
export default function YesterdayRecapSection(): React.ReactElement | null {
  const { sections, yesterdayRecap } = useDailyStore(
    useShallow((s) => ({ sections: s.sections, yesterdayRecap: s.yesterdayRecap })),
  );
  const setField = useDailyStore((s) => s.setField);

  const [model, setModel] = useState<AIModelKey>("sonnet");
  const [loading, setLoading] = useState(false);
  // Last-call usage so the analyst sees how much the call cost.
  const [lastUsage, setLastUsage] = useState<{ tokens: number; cost: number; modelLabel: string } | null>(null);

  if (!sections.find((x) => x.key === "yesterdayRecap")?.on) return null;

  const selectedModel = AI_MODELS.find((m) => m.key === model)!;

  const handleGenerate = async (): Promise<void> => {
    setLoading(true);
    setLastUsage(null);
    try {
      const today = todayLocal();
      const found = await findMostRecentDailyBefore(today, 7);
      if (!found) {
        toast.info("No prior daily found in the last 7 days. Write the recap manually.");
        return;
      }

      // Re-render yesterday's state through generateBBG so the AI
      // sees the same plain-text shape the analyst originally sent
      // out. Keeps the prompt small (vs. a full state JSON) and
      // matches the format the model is already trained against.
      const yesterdayBbg = generateBBG(found.record.state);

      // Today's snapshot in plain text, for the AI to score against.
      // Pulled from the live store so we use the freshest prices the
      // analyst has already entered (or fetched via Auto-Fetch).
      const state = useDailyStore.getState();
      const snp = state.snapshot;
      const snapshotLine = [
        snp.merval ? `Merval ${snp.merval}${snp.mervalChg ? ` (${snp.mervalChg}%)` : ""}` : "",
        snp.adrs ? `ADRs ${snp.adrs}${snp.adrsChg ? ` (${snp.adrsChg}%)` : ""}` : "",
        snp.ccl ? `CCL ${snp.ccl}` : "",
        snp.mep ? `MEP ${snp.mep}` : "",
        snp.sp500 ? `S&P ${snp.sp500}${snp.sp500Chg ? ` (${snp.sp500Chg}%)` : ""}` : "",
        snp.ust10y ? `UST10 ${snp.ust10y}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      const resp = await authedFetch("/api/ai-draft", {
        method: "POST",
        body: JSON.stringify({
          mode: "yesterday-recap",
          date: today,
          model,
          yesterdayDate: found.date,
          yesterdayDraft: yesterdayBbg,
          todaySnapshot: snapshotLine,
        }),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || "Recap generation failed");

      const recapText = typeof data.recap === "string" ? data.recap.trim() : "";
      if (!recapText) {
        toast.error("AI returned an empty recap. Try again or write manually.");
        return;
      }

      setField("yesterdayRecap", recapText);

      const inputTokens = data.usage?.input || 0;
      const outputTokens = data.usage?.output || 0;
      setLastUsage({
        tokens: inputTokens + outputTokens,
        cost: estimateCost(model, inputTokens, outputTokens),
        modelLabel: data.model || model,
      });
      toast.success(`Recap drafted from ${found.date}. Edit before publishing.`);
    } catch (err) {
      toast.error("Recap generation failed: " + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Yesterday in Review" color={BRAND.orange}>
      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 8px" }}>
        3-5 sentences scoring yesterday's calls against today's prices. Renders at
        the top of the daily — the credibility hook for institutional readers.
        Be specific. Be honest about misses.
      </p>

      <div className="mb-3">
        <label className="block mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
          Model
        </label>
        <AIModelPicker value={model} onChange={setModel} />
        <div className="text-[10px] text-[var(--text-muted)] mt-1">
          Estimated cost: ~{selectedModel.costLabel}/recap
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full py-2.5 mb-3 rounded-md border-none text-white text-xs font-bold cursor-pointer uppercase disabled:opacity-50"
        style={{ background: loading ? "#999" : "#8b5cf6" }}
      >
        {loading ? "Generating from yesterday's daily…" : "Generate from yesterday's daily"}
      </button>

      {lastUsage && (
        <div className="mb-3 text-[10px] text-[var(--text-muted)] text-center">
          Last call: {lastUsage.tokens.toLocaleString()} tokens · {lastUsage.modelLabel} · ${lastUsage.cost.toFixed(4)}
        </div>
      )}

      <Inp
        label="Recap body"
        value={yesterdayRecap}
        onChange={(v) => setField("yesterdayRecap", v)}
        multi
        rows={6}
        placeholder="Our overweight call on banks (specifically GGAL) drove the outperform; the name added 4.3% versus a Merval up 1.8%. The Bonar 30 view played out — spread to peers tightened 18bps as we'd flagged…"
      />
    </Card>
  );
}
