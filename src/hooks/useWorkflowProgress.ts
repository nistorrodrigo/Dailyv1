import { useShallow } from "zustand/react/shallow";
import useDailyStore from "../store/useDailyStore";
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
export function useWorkflowProgress(): { steps: WorkflowStep[]; doneCount: number; total: number } {
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

  const sectionOn = (key: string) => Boolean(s.sections.find((x) => x.key === key)?.on);
  const recapOn = sectionOn("yesterdayRecap");

  const steps: WorkflowStep[] = [
    {
      id: "date",
      label: "Date is today",
      done: isToday(s.date),
      hint: "Update the date in the General card. Without this, the subject and email-log timestamp are wrong.",
      anchor: "section-general",
    },
    {
      id: "snapshot",
      label: "Market snapshot has prices",
      done: Boolean(s.snapshot?.merval || s.snapshot?.adrs || s.snapshot?.sp500),
      hint: "Click 'Auto-Fetch Prices' in the Snapshot section to pull overnight closes.",
      anchor: "section-snapshot",
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
    },
    {
      id: "headline",
      label: "Headline (subject hook) set",
      done: Boolean(s.headline?.trim()) && s.headline.length <= 90,
      hint: !s.headline?.trim()
        ? "Write the day's thesis as the subject hook in the General card. Specific, opinionated, <70 chars."
        : `Headline is ${s.headline.length} chars — gets clipped past ~70 in Outlook/Gmail preview. Tighten it.`,
      anchor: "section-general",
    },
    {
      id: "summaryBar",
      label: "Summary bar written",
      done: Boolean(s.summaryBar?.trim()),
      hint: "1-2 sentences directly under the headline. Backs up the thesis with the day's key facts.",
      anchor: "section-general",
    },
    {
      id: "watchToday",
      // Optional but recommended. Treated like Yesterday Recap —
      // counts as done when the section is OFF.
      label: sectionOn("watchToday") ? "What to Watch populated" : "What to Watch (skipped)",
      done: !sectionOn("watchToday") || (s.watchToday || []).some((w) => w?.trim()),
      hint: "3-5 bullets of upcoming catalysts. The call-to-action of the daily.",
      anchor: "section-watchToday",
    },
    {
      id: "macro",
      label: "At least one macro block has body",
      done: !sectionOn("macro") || s.macroBlocks.some((b) => b.body?.trim()),
      hint: "A macro block with a title but no body looks unfinished. Either write the body or remove the block.",
      anchor: "section-macro",
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
    },
    {
      id: "flows",
      label: "Flows direction noted",
      done:
        !sectionOn("flows") ||
        Boolean(s.eqBuyer?.trim() || s.eqSeller?.trim() || s.fiBuyer?.trim() || s.fiSeller?.trim()),
      hint: "One line per direction (Eq buyer / seller / FI buyer / seller). Even 'two-way' is a useful read.",
      anchor: "section-flows",
    },
    {
      id: "signatures",
      label: "Signatures with email",
      done: s.signatures.length > 0 && s.signatures.some((sig) => sig.email?.trim()),
      hint: "At least one signature with a real reply-to email so clients can respond directly.",
      anchor: "section-signatures",
    },
  ];

  const doneCount = steps.filter((x) => x.done).length;
  return { steps, doneCount, total: steps.length };
}
