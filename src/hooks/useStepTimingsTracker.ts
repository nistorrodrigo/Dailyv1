import { useEffect, useRef } from "react";
import { useWorkflowProgress, type WorkflowStep } from "./useWorkflowProgress";
import useStepTimingsStore from "../store/useStepTimingsStore";

/**
 * Side-effect-only hook that watches workflow-step transitions and
 * records each pending → done completion to the persistent timings
 * store. Mounted ONCE at App level — running it in multiple
 * components would record the same transition twice.
 *
 * How it works:
 *
 *   - First time we see a step in pending state, we mark the
 *     timestamp (in a ref keyed by step id).
 *   - When that step flips to done, we compute the elapsed time
 *     and call `recordCompletion(stepId, minutes)`.
 *   - When a step flips done → pending (the analyst undid or
 *     deleted content), we re-mark the new pending start so the
 *     duration includes the redo work.
 *
 * Sanity bounds rejected:
 *
 *   - Duration < 30 seconds: probably an instant click cycle from
 *     the analyst toggling something twice; not real "step work".
 *   - Duration > 120 minutes: probably the laptop was closed and
 *     the session resumed hours later. Not representative of how
 *     long the step takes in flow.
 *
 * Both ends of the bound prevent outliers from skewing the median.
 */
export function useStepTimingsTracker(): void {
  const { steps } = useWorkflowProgress();
  const recordCompletion = useStepTimingsStore((s) => s.recordCompletion);

  // Holds the previous render's done-state per step. Used to detect
  // transitions on the next render. Initialized empty so the first
  // render seeds it without firing any "transition" recordings.
  const prevDoneRef = useRef<Record<string, boolean>>({});
  // Per-step "first observed pending at" timestamp. Cleared when the
  // step completes; re-set if it goes pending again.
  const pendingSinceRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const now = Date.now();
    for (const step of steps as WorkflowStep[]) {
      const seenBefore = step.id in prevDoneRef.current;
      const prevDone = prevDoneRef.current[step.id];

      if (!seenBefore) {
        // First observation — just seed the trackers. Don't record
        // a "completion" if the step happens to start as done
        // (that's a load-from-yesterday situation, not work the
        // analyst just did).
        if (!step.done) pendingSinceRef.current[step.id] = now;
      } else if (!prevDone && step.done) {
        // pending → done transition. Record if we tracked the start.
        const startedAt = pendingSinceRef.current[step.id];
        if (startedAt) {
          const durationMin = (now - startedAt) / 60000;
          if (durationMin >= 0.5 && durationMin <= 120) {
            recordCompletion(step.id, durationMin);
          }
          delete pendingSinceRef.current[step.id];
        }
      } else if (prevDone && !step.done) {
        // done → pending (undo / content removed). Re-arm the
        // tracker so the redo duration counts toward the median.
        pendingSinceRef.current[step.id] = now;
      }

      prevDoneRef.current[step.id] = step.done;
    }
  });
  // No dep array on purpose — runs on every render so transitions
  // are caught the moment a step's done flag flips. The tracking
  // logic itself is a no-op when there's no transition, so the
  // cost of re-running is negligible.
}
