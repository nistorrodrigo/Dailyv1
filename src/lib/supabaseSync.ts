import { saveDaily, loadDaily, loadMostRecentDaily } from "./dailyApi";
import { supabase } from "./supabase";
import useUIStore from "../store/useUIStore";
import useDailyStore from "../store/useDailyStore";
import { toast } from "../store/useToastStore";
import type { DailyState, UIState } from "../types";

interface StoreApi<T> {
  getState: () => T;
  setState: (partial: Partial<T>) => void;
  subscribe: (listener: () => void) => () => void;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let cleanupRegistered = false;

// ════════════════════════════════════════════════════════════════
//  Pure reconciliation decision — extracted so it's unit-testable
//  without spinning up the store / Supabase / timers.
// ════════════════════════════════════════════════════════════════

export type ReconcileDecision = "apply" | "conflict" | "noop";

/**
 * Decide what to do when a server daily comes back from a refetch.
 *
 *   - "apply"    → overwrite the live store with the server state
 *   - "conflict" → the analyst has unsaved local edits AND the
 *                  server moved on; surface the choose-a-side modal
 *   - "noop"     → nothing to do (server isn't newer, or the
 *                  analyst is deliberately viewing a different date)
 *
 * Rules:
 *   - On `mount` we always apply — a fresh page load has no
 *     in-session context to protect, and loading the latest is the
 *     whole point of the cross-device fix.
 *   - On `focus` (tab regained visibility) we're more careful:
 *       · server not newer than our last load        → noop
 *       · server daily is a *different date* than the one on
 *         screen → noop. The analyst probably opened an older
 *         daily via the History panel on purpose; a tab-switch
 *         shouldn't yank them back to today's.
 *       · same date, server newer, no local edits      → apply
 *       · same date, server newer, unsaved local edits → conflict
 */
export function reconcileDecision(opts: {
  trigger: "mount" | "focus";
  serverUpdatedAt: string | null;
  serverDate: string;
  lastLoadedUpdatedAt: string | null;
  currentDate: string;
  hasUserEdited: boolean;
}): ReconcileDecision {
  const { trigger, serverUpdatedAt, serverDate, lastLoadedUpdatedAt, currentDate, hasUserEdited } = opts;

  if (trigger === "mount") return "apply";

  // focus refetch:
  if (lastLoadedUpdatedAt && serverUpdatedAt && serverUpdatedAt <= lastLoadedUpdatedAt) {
    return "noop";
  }
  if (serverDate !== currentDate) {
    // Different date on screen — assume deliberate History navigation.
    return "noop";
  }
  return hasUserEdited ? "conflict" : "apply";
}

/**
 * Wire up sync between the in-memory zustand store and the `dailies`
 * table in Supabase.
 *
 * Cross-device model (the desk runs the builder from a laptop AND a
 * phone): localStorage is per-device, so the Supabase row is the
 * only shared truth. This sync keeps the two in step:
 *
 *   1. **On mount** — once persist hydration settles — load the
 *      most-recently-updated daily (`loadMostRecentDaily`, keyed on
 *      `updated_at` not `date`) and apply it. Both devices converge
 *      on "the daily last touched anywhere".
 *
 *   2. **On focus** — every time the tab regains visibility
 *      (`visibilitychange`), refetch and reconcile via
 *      `reconcileDecision`. This is what makes "edit on the laptop,
 *      pick up the phone" work without a manual reload. No Supabase
 *      Realtime needed — the focus event is the trigger.
 *
 *   3. **Conflict** — if the refetch finds the server newer AND the
 *      analyst has unsaved local edits, we DON'T silently overwrite.
 *      A modal (SyncConflictModal, driven by `useUIStore.syncConflict`)
 *      lets them pick "use the server version" or "keep mine".
 *
 *   4. **Autosave** — store mutations debounce-save at 2 s. Before
 *      each save we refetch `updated_at` and bail if the server is
 *      newer than our last load — the concurrent-write backstop.
 *
 * `applyingServerState` flag: applying a server payload calls
 * `setState`, which synchronously notifies the autosave subscriber.
 * The flag lets the subscriber distinguish "server applied this"
 * from "the analyst typed this" — replacing the previous, fragile
 * `saveStatus === "saved"` heuristic.
 */
export function setupSupabaseSync(dataStore: StoreApi<DailyState>): void {
  if (!supabase) return;

  const setSaveStatus = (status: UIState["saveStatus"]): void => useUIStore.getState().setSaveStatus(status);

  // True only while we're pushing a server payload into the store —
  // see the class comment. Lets the autosave subscriber skip the
  // server-applied setState.
  let applyingServerState = false;

  // Whether the analyst has typed anything since the last server
  // apply. Drives the conflict branch in reconcileDecision.
  let hasUserEdited = false;

  // `updated_at` of the daily we last loaded — the watermark every
  // newer-than check compares against.
  let lastLoadedUpdatedAt: string | null = null;

  /** Push a server daily into the live store. Wrapped in the
   *  `applyingServerState` flag so the autosave subscriber doesn't
   *  mistake it for a user edit. */
  const applyServerDaily = (state: DailyState, updatedAt: string | null): void => {
    applyingServerState = true;
    dataStore.setState({ ...state });
    applyingServerState = false;
    lastLoadedUpdatedAt = updatedAt;
    hasUserEdited = false;
    setSaveStatus("saved");
  };

  /** Fetch the most-recent daily and reconcile it against the live
   *  store per `reconcileDecision`. */
  const refetchAndReconcile = async (trigger: "mount" | "focus"): Promise<void> => {
    let daily;
    try {
      daily = await loadMostRecentDaily();
    } catch {
      // Offline / transient — the autosave loop and the next focus
      // refetch will catch up. Silent.
      return;
    }
    if (!daily?.state) return;
    const serverUpdatedAt = (daily as { updated_at?: string }).updated_at ?? null;

    const decision = reconcileDecision({
      trigger,
      serverUpdatedAt,
      serverDate: daily.state.date,
      lastLoadedUpdatedAt,
      currentDate: dataStore.getState().date,
      hasUserEdited,
    });

    if (decision === "noop") return;

    if (decision === "apply") {
      applyServerDaily(daily.state, serverUpdatedAt);
      if (trigger === "focus") {
        toast.info("Synced the latest version from another device.");
      }
      return;
    }

    // decision === "conflict": surface the choose-a-side modal. The
    // resolver callbacks close over `lastLoadedUpdatedAt` so the
    // outcome is consistent with the autosave's concurrent-write
    // check.
    useUIStore.getState().setSyncConflict({
      serverDate: daily.state.date,
      serverUpdatedAt: serverUpdatedAt || "",
      onUseServer: () => {
        applyServerDaily(daily.state, serverUpdatedAt);
        useUIStore.getState().setSyncConflict(null);
      },
      onKeepMine: () => {
        // Keep the local edits. Bump the watermark to the server's
        // current value so the next autosave's concurrent-write
        // check passes and our version overwrites theirs.
        lastLoadedUpdatedAt = serverUpdatedAt;
        useUIStore.getState().setSyncConflict(null);
      },
    });
  };

  // Initial load — deferred until persist hydration settles so we
  // don't race the localStorage merge.
  const hydrationApi = (useDailyStore as unknown as {
    persist?: { onFinishHydration?: (cb: () => void) => () => void; hasHydrated?: () => boolean };
  }).persist;
  const runMountLoad = () => void refetchAndReconcile("mount");
  if (hydrationApi?.hasHydrated?.()) {
    runMountLoad();
  } else if (hydrationApi?.onFinishHydration) {
    hydrationApi.onFinishHydration(runMountLoad);
  } else {
    runMountLoad();
  }

  // Refetch whenever the tab regains visibility. This is the
  // cross-device trigger — switch from the laptop to the phone,
  // bring the app to the foreground, and the phone pulls the latest.
  const onVisibility = (): void => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      void refetchAndReconcile("focus");
    }
  };
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibility);
  }

  // Subscribe to store changes and debounce-save.
  const unsubscribe = dataStore.subscribe(() => {
    // Server-applied change — not a user edit, don't autosave it.
    if (applyingServerState) return;

    hasUserEdited = true;
    setSaveStatus("saving");

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        const state = dataStore.getState();
        // Concurrent-write backstop: refetch the row's updated_at
        // and bail if the server moved past our watermark. Prevents
        // clobbering a save that landed from another device in the
        // 2 s debounce window.
        if (lastLoadedUpdatedAt) {
          const fresh = await loadDaily(state.date);
          const freshUpdatedAt = (fresh as { updated_at?: string } | null)?.updated_at;
          if (freshUpdatedAt && freshUpdatedAt > lastLoadedUpdatedAt) {
            console.warn("[supabaseSync] Server has newer version — skipping save to avoid clobber");
            setSaveStatus("error");
            toast.error("This daily changed on another device. Switch away and back to sync.");
            return;
          }
        }
        const saved = await saveDaily(state.date, state);
        lastLoadedUpdatedAt = (saved as { updated_at?: string } | null)?.updated_at ?? lastLoadedUpdatedAt;
        setSaveStatus("saved");
        setTimeout(() => {
          if (useUIStore.getState().saveStatus === "saved") setSaveStatus("idle");
        }, 1500);
      } catch (err) {
        console.error("Supabase save failed:", err);
        setSaveStatus("error");
      }
    }, 2000);
  });

  // HMR cleanup so the dev server doesn't accumulate subscriptions /
  // listeners on every save.
  if (typeof import.meta !== "undefined" && import.meta.hot && !cleanupRegistered) {
    cleanupRegistered = true;
    import.meta.hot.dispose(() => {
      unsubscribe();
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
      if (debounceTimer) clearTimeout(debounceTimer);
    });
  }
}
