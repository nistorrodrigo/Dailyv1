import type { DailyState } from "../types";
import { isToday, todayLocal } from "./dates";

/** Runtime store shape — DailyState plus the `flows` extension field
 *  that lives on the store but isn't part of the bare DailyState type.
 *  See `src/store/slices/_helpers.ts` for the canonical compose. */
type StateWithFlows = DailyState & {
  flows?: { global: string; local: string; positioning: string };
};

/**
 * Pre-flight review — a synchronous, deterministic scan for "obvious"
 * gaps in the draft that a human-readable rule can detect without
 * spending an Anthropic API call to do it. Surfaces the kind of
 * mechanical mistake an analyst might make at 7:45 AM after a long
 * night (toggled a section on then forgot to write it; pasted a
 * ticker but skipped the rationale; left summaryBar blank).
 *
 * Returns an array of issue strings, each phrased like the AI Review
 * would phrase one — so the panel can either render them next to
 * AI-found issues with the same look, or short-circuit the API call
 * entirely when the daily is so incomplete that it's not worth
 * Anthropic's tokens yet.
 *
 * Heuristic only: false negatives are fine ("the macro block has
 * great prose but contradicts the snapshot" is the AI's job to spot).
 * False positives are not — every check here must be precise enough
 * that the analyst can't argue with it.
 */
export function preflightReview(state: StateWithFlows, now: Date = new Date()): string[] {
  const issues: string[] = [];

  // ── Date sanity ───────────────────────────────────────────────
  // Most-likely-to-be-wrong field. Catches the "I forgot to click
  // New Daily" case before the analyst spends an AI call to find
  // out the rest of the daily references stale data.
  if (!isToday(state.date, now)) {
    issues.push(
      `Daily date is "${state.date}", but today is "${todayLocal(now)}". ` +
        `If this is intentional (e.g. drafting a backlog daily), ignore. ` +
        `Otherwise update the date in the General section.`,
    );
  }

  // ── Summary bar ───────────────────────────────────────────────
  if (!state.summaryBar?.trim()) {
    issues.push("Summary Bar is empty — the top-of-email one-liner is missing.");
  }

  // ── Macro blocks ──────────────────────────────────────────────
  const macroOn = state.sections.find((s) => s.key === "macro")?.on;
  if (macroOn) {
    if (!state.macroBlocks.length) {
      issues.push("Macro section is toggled on but has no blocks.");
    } else {
      state.macroBlocks.forEach((b, i) => {
        const label = b.title?.trim() || `block #${i + 1}`;
        if (!b.title?.trim()) issues.push(`Macro ${label} has no title.`);
        if (!b.body?.trim()) issues.push(`Macro "${label}" has no body — only a title.`);
      });
    }
  }

  // ── Trade ideas ───────────────────────────────────────────────
  const tradeOn = state.sections.find((s) => s.key === "tradeIdeas")?.on;
  if (tradeOn) {
    if (!state.equityPicks.length && !state.fiIdeas.length) {
      issues.push("Trade Ideas section is toggled on but has neither equity picks nor FI ideas.");
    }
    state.equityPicks.forEach((p, i) => {
      const label = p.ticker?.trim() || `pick #${i + 1}`;
      if (!p.ticker?.trim()) issues.push(`Equity pick #${i + 1} has no ticker.`);
      if (!p.reason?.trim()) issues.push(`Equity pick ${label} has no rationale.`);
    });
    state.fiIdeas.forEach((f, i) => {
      const label = f.idea?.trim() || `idea #${i + 1}`;
      if (!f.idea?.trim()) issues.push(`FI idea #${i + 1} has no name.`);
      if (!f.reason?.trim()) issues.push(`FI idea ${label} has no rationale.`);
    });
  }

  // ── Flows colour ──────────────────────────────────────────────
  const flowsOn = state.sections.find((s) => s.key === "flows")?.on;
  if (flowsOn) {
    const f = state.flows;
    if (!f?.global?.trim() && !f?.local?.trim() && !f?.positioning?.trim()) {
      issues.push("Flows section is toggled on but all three flow notes (global / local / positioning) are empty.");
    }
  }

  // ── Top movers ────────────────────────────────────────────────
  const moversOn = state.sections.find((s) => s.key === "topMovers")?.on;
  if (moversOn) {
    const tm = state.topMovers;
    if (!tm?.gainers?.length && !tm?.losers?.length) {
      issues.push("Top Movers section is toggled on but both gainers and losers are empty.");
    }
  }

  // ── Events ────────────────────────────────────────────────────
  const eventsOn = state.sections.find((s) => s.key === "events")?.on;
  if (eventsOn && !state.events.length) {
    issues.push("Events section is toggled on but no events are listed.");
  }

  const keyEventsOn = state.sections.find((s) => s.key === "macroEstimates")?.on;
  if (keyEventsOn && !state.keyEvents.length) {
    issues.push("Key Events / Macro Estimates section is toggled on but is empty.");
  }

  // ── Corporate (earnings notes) ────────────────────────────────
  const corpOn = state.sections.find((s) => s.key === "corporate")?.on;
  if (corpOn) {
    if (!state.corpBlocks.length) {
      issues.push("Corporate section is toggled on but has no earnings/news blocks.");
    } else {
      state.corpBlocks.forEach((b, i) => {
        const label = b.headline?.trim() || `block #${i + 1}`;
        if (!b.headline?.trim()) issues.push(`Corporate block #${i + 1} has no headline.`);
        if (!b.body?.trim()) issues.push(`Corporate "${label}" has no body.`);
      });
    }
  }

  // ── Watch today ───────────────────────────────────────────────
  const watchOn = state.sections.find((s) => s.key === "watchToday")?.on;
  if (watchOn) {
    const filled = state.watchToday?.filter((x) => x?.trim()).length || 0;
    if (filled === 0) {
      issues.push("What to Watch Today section is toggled on but has no items.");
    }
  }

  // ── Signatures ────────────────────────────────────────────────
  if (!state.signatures.length) {
    issues.push("No signatures defined — the daily will go out without analyst contact info.");
  } else {
    const noEmail = state.signatures.filter((s) => !s.email?.trim()).length;
    if (noEmail === state.signatures.length) {
      issues.push("All signatures are missing email addresses.");
    }
  }

  return issues;
}
