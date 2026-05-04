import type { DailyState } from "../types";
import { isToday, todayLocal } from "./dates";

/** Inputs the AI Draft tab cares about beyond the bare DailyState —
 *  the analyst's typed context and the "Include news" toggle. */
export interface DraftPreflightInputs {
  context: string;
  includeNews: boolean;
}

/**
 * Pre-flight scan for the AI Draft tab. Mirrors `preflightReview` in
 * intent — surface issues a deterministic rule can catch before the
 * analyst spends an Anthropic call. Differs in what counts as a
 * problem because Draft and Review optimise different things:
 *
 *   - **Review** wants a structurally complete daily to evaluate;
 *     empty toggled-on sections are bad.
 *
 *   - **Draft** wants enough *signal* for the AI to write something
 *     specific to today rather than generic Argentina-macro pablum.
 *     An empty context box AND no news feed AND no analyst coverage
 *     means the model is guessing, and Sonnet at $3/$15 per MTok is
 *     not worth that guess.
 *
 * Returns an array of issues. Empty array = "preflight clean, fire
 * away". Each string is short and concrete. Same display contract
 * as the Review preflight: the panel renders them above the
 * Generate button as "Quick checks (no API call)".
 */
export function preflightDraft(
  state: DailyState,
  inputs: DraftPreflightInputs,
  now: Date = new Date(),
): string[] {
  const issues: string[] = [];

  // Date mismatch — same warning as Review. The AI uses `date` to
  // anchor the draft ("Today is X. Generate today's daily…"), so a
  // wrong date produces a daily for the wrong day.
  if (!isToday(state.date, now)) {
    issues.push(
      `Daily date is "${state.date}", but today is "${todayLocal(now)}". ` +
        `The AI will draft for ${state.date}, not today.`,
    );
  }

  // No signal — neither typed context nor live news. Without one of
  // these, the model has no anchor for "what happened this morning"
  // and falls back to generic Argentina narratives that aren't
  // useful before the open.
  const ctxEmpty = !inputs.context.trim();
  if (ctxEmpty && !inputs.includeNews) {
    issues.push(
      "No context typed AND news toggle is off. The AI has nothing to anchor the draft to today's events. " +
        "Add 1-2 lines of bullet-point context (rates, prints, political news), or turn on Include news.",
    );
  }

  // No analyst coverage — `analysts` array drives the equity picks
  // section. The endpoint passes the ticker list as part of the
  // user prompt; without it the AI invents tickers that may not
  // even be in coverage.
  const coverage = state.analysts.flatMap((a) => a.coverage || []);
  if (!coverage.length) {
    issues.push(
      "Analyst database has no coverage tickers. AI equity picks will be invented rather than drawn from your universe. " +
        "Add tickers in the Analysts tab first, or accept that the equity-picks output will need full manual replacement.",
    );
  }

  // No signatures — not blocking the draft itself, but the AI doesn't
  // know who's signing and the daily can't be sent without one. Worth
  // a heads-up at draft time so it's not a surprise at send time.
  if (!state.signatures.length) {
    issues.push(
      "No signatures defined. The drafted daily won't have a sign-off block; you'll need to add one before sending.",
    );
  }

  return issues;
}
