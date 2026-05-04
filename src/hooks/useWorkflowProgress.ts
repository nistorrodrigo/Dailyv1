import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../store/useDailyStore";
import useStepTimingsStore from "../store/useStepTimingsStore";
import { isToday } from "../utils/dates";

/** A single step in the morning workflow. The shape is shared between
 *  the Header chip (which counts done vs total) and the WorkflowPanel
 *  (which renders the full checklist with hints + section anchors). */
export interface WorkflowStep {
  id: string;
  label: string;
  done: boolean;
  /** Why this step matters / what to do. Shown inline in the panel
   *  when the step isn't done. Empty for completed steps. */
  hint: string;
  /** DOM id of the editor section to scroll to when the analyst
   *  clicks the step. EditorTab tags each rendered section with
   *  `id="section-<key>"`. Steps that don't map to a section
   *  (e.g. "Send Email" — that's a panel button) leave this empty. */
  anchor?: string;
  /** Heuristic minutes typically spent on this step. Used as the
   *  fallback for the "time to ready" estimate when there's no
   *  per-analyst session history yet. */
  estMinutes: number;
  /** Median duration in minutes from the analyst's own past sessions
   *  (rolling 30-day window, ≥3 samples required). `null` when there
   *  isn't enough history to override the heuristic — the panel
   *  shows just `~estMinutes` in that case. */
  medianMinutes: number | null;
  /** Best-available estimate: `medianMinutes` when present, else
   *  `estMinutes`. This is what the chip subtitle and panel time
   *  totals sum from. */
  effectiveMinutes: number;
}

/**
 * The morning workflow checklist — derived live from store state on
 * every render. Reading from Zustand via `useShallow` ensures we
 * only re-render when one of these specific fields changes, not on
 * every keystroke in unrelated sections.
 *
 * Order matches the recommended morning sequence in CLAUDE.md /
 * the workflow doc — setup → tesis → content → review → send.
 * The analyst doesn't HAVE to follow the order (the editor stays
 * free-form), but the checklist surfaces what's left in a way that
 * naturally guides the sequence.
 *
 * Every step is BINARY done / not done. No partial credit. Easier
 * to reason about and easier to render. If a step needs more nuance
 * (e.g. "headline is set BUT >90 chars"), it stays "not done" and
 * the hint explains the issue.
 */
export function useWorkflowProgress(): {
  steps: WorkflowStep[];
  doneCount: number;
  total: number;
  /** Sum of heuristic minutes for steps still pending. Done steps
   *  contribute 0. Used by the Header chip + panel to surface a
   *  "time to ready" guidepost — meant to anchor the analyst's
   *  send-by-10AM mental schedule, not as a deadline. */
  estimatedMinutesRemaining: number;
} {
  const s = useDailyStore(
    useShallow((s) => ({
      date: s.date,
      headline: s.headline,
      summaryBar: s.summaryBar,
      watchToday: s.watchToday,
      macroBlocks: s.macroBlocks,
      equityPicks: s.equityPicks,
      fiIdeas: s.fiIdeas,
      eqBuyer: s.eqBuyer,
      eqSeller: s.eqSeller,
      fiBuyer: s.fiBuyer,
      fiSeller: s.fiSeller,
      yesterdayRecap: s.yesterdayRecap,
      sections: s.sections,
      signatures: s.signatures,
      snapshot: s.snapshot,
    })),
  );

  // Subscribe to the timings store so this hook re-renders when a
  // new median lands (e.g. the analyst just completed a step and the
  // tracker recorded it). Reading via the function selector keeps the
  // shape stable per call.
  const timingsHistory = useStepTimingsStore((st) => st.history);
  const medianFor = useStepTimingsStore((st) => st.medianFor);

  const sectionOn = (key: string) => Boolean(s.sections.find((x) => x.key === key)?.on);
  const recapOn = sectionOn("yesterdayRecap");

  // Build the raw steps first (without the timing-augmented fields),
  // then map to enhance each with `medianMinutes` and
  // `effectiveMinutes`. Two-pass keeps the inline definitions
  // readable — every step would otherwise repeat the same
  // `medianMinutes: medianFor(...)` plumbing.
  type RawStep = Omit<WorkflowStep, "medianMinutes" | "effectiveMinutes">;
  const rawSteps: RawStep[] = [
    {
      id: "date",
      label: "Date is today",
      done: isToday(s.date),
      hint: "Update the date in the General card. Without this, the subject and email-log timestamp are wrong.",
      anchor: "section-general",
      estMinutes: 1,
    },
    {
      id: "snapshot",
      label: "Market snapshot has prices",
      done: Boolean(s.snapshot?.merval || s.snapshot?.adrs || s.snapshot?.sp500),
      hint: "Click 'Auto-Fetch Prices' in the Snapshot section to pull overnight closes.",
      anchor: "section-snapshot",
      // One click of Auto-Fetch fills it. ~1 min including waiting
      // for the fetch and eyeballing the values.
      estMinutes: 1,
    },
    {
      id: "yesterdayRecap",
      // Yesterday Recap is opt-in. When the section is OFF, count
      // it as "done" (i.e. consciously skipped — don't nag the
      // analyst about a credibility lever they chose not to use).
      label: recapOn ? "Yesterday-in-Review drafted" : "Yesterday-in-Review (skipped)",
      done: !recapOn || Boolean(s.yesterdayRecap?.trim()),
      hint: "Toggle 'Yesterday in Review' on, then click 'Generate from yesterday's daily' for an AI draft you can refine.",
      anchor: "section-yesterdayRecap",
      // AI generates in ~10s; the analyst typically edits 1-2
      // sentences for personal context. Net ~3 min.
      estMinutes: 3,
    },
    {
      id: "headline",
      label: "Headline (subject hook) set",
      done: Boolean(s.headline?.trim()) && s.headline.length <= 90,
      hint: !s.headline?.trim()
        ? "Write the day's thesis as the subject hook in the General card. Specific, opinionated, <70 chars."
        : `Headline is ${s.headline.length} chars — gets clipped past ~70 in Outlook/Gmail preview. Tighten it.`,
      anchor: "section-general",
      // Most-thought step. The headline forces articulation of the
      // day's thesis; getting it right takes real cognitive effort.
      estMinutes: 5,
    },
    {
      id: "summaryBar",
      label: "Summary bar written",
      done: Boolean(s.summaryBar?.trim()),
      hint: "1-2 sentences directly under the headline. Backs up the thesis with the day's key facts.",
      anchor: "section-general",
      estMinutes: 3,
    },
    {
      id: "watchToday",
      label: sectionOn("watchToday") ? "What to Watch populated" : "What to Watch (skipped)",
      done: !sectionOn("watchToday") || (s.watchToday || []).some((w) => w?.trim()),
      hint: "3-5 bullets of upcoming catalysts. The call-to-action of the daily.",
      anchor: "section-watchToday",
      estMinutes: 3,
    },
    {
      id: "macro",
      label: "At least one macro block has body",
      done: !sectionOn("macro") || s.macroBlocks.some((b) => b.body?.trim()),
      hint: "A macro block with a title but no body looks unfinished. Either write the body or remove the block.",
      anchor: "section-macro",
      // The bulk of the writing. Per-block ~5 min × 2-3 blocks.
      // Estimate covers AT LEAST ONE having a body — the threshold
      // for the step to flip done. The analyst typically writes
      // more, but the step doesn't require all of them.
      estMinutes: 12,
    },
    {
      id: "tradeIdeas",
      label: "Trade idea has rationale",
      done:
        !sectionOn("tradeIdeas") ||
        s.equityPicks.some((p) => p.ticker?.trim() && p.reason?.trim()) ||
        s.fiIdeas.some((f) => f.idea?.trim() && f.reason?.trim()),
      hint: "Foreign PMs forward dailies with specific rationales, not just tickers. Add a one-line thesis to at least one pick.",
      anchor: "section-tradeIdeas",
      estMinutes: 5,
    },
    {
      id: "flows",
      label: "Flows direction noted",
      done:
        !sectionOn("flows") ||
        Boolean(s.eqBuyer?.trim() || s.eqSeller?.trim() || s.fiBuyer?.trim() || s.fiSeller?.trim()),
      hint: "One line per direction (Eq buyer / seller / FI buyer / seller). Even 'two-way' is a useful read.",
      anchor: "section-flows",
      estMinutes: 2,
    },
    {
      id: "signatures",
      label: "Signatures with email",
      done: s.signatures.length > 0 && s.signatures.some((sig) => sig.email?.trim()),
      hint: "At least one signature with a real reply-to email so clients can respond directly.",
      anchor: "section-signatures",
      // Should already be set from the previous day; almost always
      // 0 min on a normal morning. Bumped to 1 to cover edge cases.
      estMinutes: 1,
    },
  ];

  // Reference `timingsHistory` so the linter sees the dependency —
  // calling `medianFor` reads from it indirectly, and we want the
  // hook to re-render when it changes. (The selector subscription
  // above is what actually triggers the re-render; this is just a
  // belt-and-braces noop reference for clarity.)
  void timingsHistory;

  const steps: WorkflowStep[] = rawSteps.map((step) => {
    const median = medianFor(step.id);
    return {
      ...step,
      medianMinutes: median,
      effectiveMinutes: median != null ? Math.round(median) : step.estMinutes,
    };
  });

  const doneCount = steps.filter((x) => x.done).length;
  const estimatedMinutesRemaining = steps
    .filter((x) => !x.done)
    .reduce((sum, x) => sum + x.effectiveMinutes, 0);
  return { steps, doneCount, total: steps.length, estimatedMinutesRemaining };
}
