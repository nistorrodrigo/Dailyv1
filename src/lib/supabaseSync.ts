import { saveDaily, loadDaily } from "./dailyApi";
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

/**
 * Wire up bidirectional sync between the in-memory zustand store
 * and the per-date Supabase row in `dailies`.
 *
 * Two failure modes the audit surfaced and this version handles:
 *
 *   1. **Hydration race**: setupSupabaseSync is called from main.tsx
 *      synchronously, before persist has rehydrated localStorage AND
 *      before any user-triggered render. Three concurrent sources
 *      compete to set the live state:
 *        a) the seed `DEFAULT_STATE` from store create
 *        b) persist rehydrating from localStorage
 *        c) `loadDaily(date)` from Supabase
 *      The previous version blindly applied `loadDaily`'s result the
 *      moment it returned — overwriting whatever the persist
 *      hydration had just landed, AND clobbering edits the analyst
 *      started typing within the first ~500 ms. Fix: wait for
 *      `useDailyStore.persist.onFinishHydration` before loading,
 *      and track a `hasUserEditedRef` so we don't overwrite
 *      analyst-typed content with stale server state.
 *
 *   2. **Multi-tab autosave race**: two tabs open on the same daily,
 *      both debounce-save at ~2 s. The later write wins, the earlier
 *      tab's edits silently disappear. Fix: read the `updated_at`
 *      timestamp from the row before each save and bail-with-warning
 *      if it's newer than the version we last loaded — surfaces as
 *      a toast prompting the analyst to reload.
 */
export function setupSupabaseSync(dataStore: StoreApi<DailyState>): void {
  if (!supabase) return;

  const setSaveStatus = (status: UIState["saveStatus"]): void => useUIStore.getState().setSaveStatus(status);

  // Track whether the analyst has actually touched anything since
  // mount. If `false`, the loadDaily payload safely overwrites the
  // initial state (no edits to lose). If `true`, the autosave loop
  // is running and we never overwrite — at worst we warn that the
  // server has a newer version.
  let hasUserEdited = false;

  // The `updated_at` from the most recent successful load. Used by
  // saveDaily to detect concurrent-tab writes — if the server's
  // current `updated_at` is greater than ours, another tab beat us
  // to the punch.
  let lastLoadedUpdatedAt: string | null = null;

  // Defer the initial Supabase load until persist hydration is
  // settled. Zustand persist runs async on first render; reading
  // state.date synchronously here would grab the pre-hydration
  // DEFAULT_STATE date (today) instead of the analyst's persisted
  // draft date. The `onFinishHydration` callback fires once
  // localStorage has been merged in.
  const runInitialLoad = (): void => {
    const date = dataStore.getState().date;
    if (!date) return;
    loadDaily(date)
      .then((daily) => {
        if (!daily?.state) return;
        // If the analyst has already started typing during the
        // load round-trip, don't clobber their work — surface a
        // soft notice instead.
        if (hasUserEdited) {
          console.warn("[supabaseSync] Server payload landed after edits started — skipping overwrite");
          return;
        }
        dataStore.setState({ ...daily.state });
        // Capture server's updated_at for the concurrent-write
        // check below.
        // The Supabase typings expose this via the raw record;
        // we read defensively in case it's missing.
        lastLoadedUpdatedAt = (daily as { updated_at?: string }).updated_at ?? null;
        setSaveStatus("saved");
      })
      .catch(() => {
        // Silent — the editor falls back to whatever persist
        // landed and the autosave loop will catch up.
      });
  };

  const hydrationApi = (useDailyStore as unknown as { persist?: { onFinishHydration?: (cb: () => void) => () => void; hasHydrated?: () => boolean } }).persist;
  if (hydrationApi?.hasHydrated?.()) {
    runInitialLoad();
  } else if (hydrationApi?.onFinishHydration) {
    hydrationApi.onFinishHydration(runInitialLoad);
  } else {
    // Fallback for environments without the persist API (tests).
    runInitialLoad();
  }

  // Subscribe to data store changes and debounce save.
  const unsubscribe = dataStore.subscribe(() => {
    // Don't flip to "saving" on the implicit set from runInitialLoad
    // above — that wasn't a user edit. Set the flag first; this
    // notification is either the load-write (caught by hasUserEdited
    // staying false) or a real edit.
    if (!hasUserEdited) {
      // The first store mutation could be either the load-induced
      // setState (which we shouldn't treat as a user edit) or a
      // genuine first keystroke. Heuristic: if the saveStatus is
      // currently "saved" (just set by load), the mutation is the
      // load. Otherwise it's a real edit.
      if (useUIStore.getState().saveStatus === "saved") return;
      hasUserEdited = true;
    }
    setSaveStatus("saving");

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        const state = dataStore.getState();
        // Concurrent-write check: refetch the server's
        // updated_at and bail if it's newer than what we last
        // loaded. The check fires before the actual save so we
        // never overwrite another tab's work.
        if (lastLoadedUpdatedAt) {
          const fresh = await loadDaily(state.date);
          const freshUpdatedAt = (fresh as { updated_at?: string } | null)?.updated_at;
          if (freshUpdatedAt && freshUpdatedAt > lastLoadedUpdatedAt) {
            console.warn("[supabaseSync] Server has newer version — skipping save to avoid clobber");
            setSaveStatus("error");
            toast.error("Another tab edited this daily. Reload to merge.");
            return;
          }
        }
        const saved = await saveDaily(state.date, state);
        lastLoadedUpdatedAt = (saved as { updated_at?: string } | null)?.updated_at ?? lastLoadedUpdatedAt;
        setSaveStatus("saved");
        setTimeout(() => {
          if (useUIStore.getState().saveStatus === "saved") {
            setSaveStatus("idle");
          }
        }, 1500);
      } catch (err) {
        console.error("Supabase save failed:", err);
        setSaveStatus("error");
      }
    }, 2000);
  });

  // HMR cleanup so the dev server doesn't accumulate subscriptions
  // on every save. Production module-load is once-per-tab so this
  // is dev-only insurance.
  if (typeof import.meta !== "undefined" && import.meta.hot && !cleanupRegistered) {
    cleanupRegistered = true;
    import.meta.hot.dispose(() => {
      unsubscribe();
      if (debounceTimer) clearTimeout(debounceTimer);
    });
  }
}
