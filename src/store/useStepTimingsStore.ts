import { create } from "zustand";
import { persist } from "zustand/middleware";

/** A single recorded duration for a workflow step completion. */
interface TimingEntry {
  /** Minutes the step was pending before transitioning to done. */
  durationMin: number;
  /** Unix epoch ms — used to age out entries older than 30 days. */
  timestamp: number;
}

/** Per-step rolling history of completion durations, persisted to
 *  localStorage so the panel's "median" shows real averages across
 *  sessions (not just the current tab). Capped at 30 entries per
 *  step — old data isn't useful for "how long does this typically
 *  take me TODAY". */
interface StepTimingsState {
  history: Record<string, TimingEntry[]>;
  /** Append a duration for `stepId`, capped at the most-recent
   *  `MAX_PER_STEP` entries. Called by the tracker on each
   *  pending → done transition. */
  recordCompletion: (stepId: string, durationMin: number) => void;
  /** Median of recent durations for a step. Returns null when there
   *  are fewer than `MIN_SAMPLES` entries — a single anecdote isn't
   *  enough to override the heuristic estimate. */
  medianFor: (stepId: string) => number | null;
}

const STORAGE_KEY = "ls-step-timings-v1";
const MAX_PER_STEP = 30;
const MIN_SAMPLES = 3;
/** Drop entries older than 30 days. Keeps the median fresh — 3-month-old
 *  durations from when the analyst was new aren't representative. */
const AGE_LIMIT_MS = 30 * 24 * 60 * 60 * 1000;

const median = (arr: number[]): number => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const useStepTimingsStore = create<StepTimingsState>()(
  persist(
    (set, get) => ({
      history: {},
      recordCompletion: (stepId, durationMin) => {
        const now = Date.now();
        set((s) => {
          const existing = s.history[stepId] || [];
          // Drop stale entries before appending so the cap stays
          // meaningful. Single sweep, O(n) per recording.
          const fresh = existing.filter((e) => now - e.timestamp < AGE_LIMIT_MS);
          const updated = [...fresh, { durationMin, timestamp: now }].slice(-MAX_PER_STEP);
          return { history: { ...s.history, [stepId]: updated } };
        });
      },
      medianFor: (stepId) => {
        const entries = get().history[stepId] || [];
        // Apply the same age filter at read time so a recently-loaded
        // history with old entries doesn't poison the median.
        const fresh = entries.filter((e) => Date.now() - e.timestamp < AGE_LIMIT_MS);
        if (fresh.length < MIN_SAMPLES) return null;
        return median(fresh.map((e) => e.durationMin));
      },
    }),
    { name: STORAGE_KEY, version: 1 },
  ),
);

export default useStepTimingsStore;
