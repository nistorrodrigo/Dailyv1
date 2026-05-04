import { useEffect, useRef } from "react";
import useDailyStore from "../store/useDailyStore";
import { saveVersion } from "../lib/versionsApi";
import { supabase } from "../lib/supabase";

// Auto-snapshot interval — 5 minutes is the sweet spot. The live
// per-date autosave already preserves work on every edit; the
// purpose of this rollback log is "I made a destructive change 10
// minutes ago, undo it." Saving more often clutters the history
// with near-duplicates; less often risks losing a recovery point.
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000;
// How long an edit-burst is allowed to settle before we count the
// next interval. Without this, an analyst who's typing continuously
// would never get an autosave because every keystroke "resets" the
// idea of an edit. The interval is anchored on real-time, this is
// only the dirty-flag trigger threshold.
const EDIT_DEBOUNCE_MS = 2 * 1000;

/**
 * Auto-snapshot the current daily into the rollback log every 5
 * minutes — but only when there were actual edits since the last
 * snapshot. Same idea as Google Docs version history: silent in
 * the background, surface via the History panel.
 *
 * Why this exists alongside the per-date autosave (`supabaseSync`):
 * the per-date save overwrites a single row, so an aggressive
 * edit ("I deleted the macro section, then closed the tab")
 * doesn't survive. Versions are immutable rows the analyst can
 * roll back to.
 *
 * Pause/resume: skip when the tab isn't visible (no edits to capture
 * anyway, and we don't want background tabs burning Supabase rows).
 *
 * Skip when supabase isn't configured — local dev / disconnected
 * mode degrades gracefully to the existing zundo undo stack.
 */
export function useAutoSnapshot(): void {
  const dirtyRef = useRef<boolean>(false);
  const lastEditAtRef = useRef<number>(0);
  // Tracks whether we've ever saved a snapshot in this session, so
  // the interval doesn't fire a save 5 min after the page opened
  // when the analyst hasn't actually touched anything.
  const lastSnapshotAtRef = useRef<number>(0);

  useEffect(() => {
    if (!supabase) return;

    // Mark dirty on every store mutation. zustand emits a notify
    // for every action; we don't try to filter by what changed
    // (cheap to call, the interval coalesces).
    const unsubscribe = useDailyStore.subscribe(() => {
      dirtyRef.current = true;
      lastEditAtRef.current = Date.now();
    });

    const interval = setInterval(async () => {
      if (!dirtyRef.current) return;
      // Tab hidden → wait. Snapshot meaningful changes only.
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      // Edit-burst settling: if the analyst was typing in the last
      // few seconds, defer to the next tick. Otherwise we'd snapshot
      // mid-thought.
      if (Date.now() - lastEditAtRef.current < EDIT_DEBOUNCE_MS) return;

      const state = useDailyStore.getState();
      if (!state.date) return;

      try {
        const meta = await saveVersion(state.date, state);
        if (meta) {
          dirtyRef.current = false;
          lastSnapshotAtRef.current = Date.now();
        }
      } catch {
        // Silent — the snapshot log is best-effort. Failed saves
        // leave dirtyRef true so the next interval retries.
      }
    }, SNAPSHOT_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);
}
