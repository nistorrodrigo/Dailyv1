import { useEffect } from "react";
import useDailyStore from "../store/useDailyStore";
import { DEFAULT_STATE } from "../constants/defaultState";
import type { Section } from "../types";

// One-shot flag: set after the v3 forced re-introduction has run on
// this device. Prevents the force-reset from firing on every page
// load — once it's run, the analyst's subsequent toggles stick.
const V3_RESYNC_FLAG = "ls-daily-sections-resync-v3-done";
// The three keys we shipped recently that some analysts ended up
// without (or with `on:false`) due to the mid-version persist drift.
// On the v3 resync run, these are forced back to the catalogue's
// default — overriding any stale persisted entry.
const V3_FORCE_REINTRODUCE = new Set(["marketComment", "latestReports", "yesterdayRecap"]);

/**
 * Belt-and-suspenders patch for section-catalogue drift.
 *
 * Zustand persist's `migrate` + `merge` callbacks should already keep
 * the persisted `sections` array aligned with the canonical
 * `DEFAULT_STATE.sections` catalogue. In practice we've seen edge
 * cases where a hydrated state still misses keys we shipped — partly
 * because section keys were added across commits without bumping the
 * persist version, partly because the migrate hook only runs on
 * version mismatch (it's a no-op for users whose persisted version
 * already equals the current), and we've seen at least one case
 * where the user's persisted state had the keys at `on:false` after
 * an aborted mid-version load (so the normal `||` merge couldn't
 * revive them — the entries existed, just disabled).
 *
 * Two passes:
 *   1. v3 force-resync (one-shot, gated by V3_RESYNC_FLAG): override
 *      the three recently-shipped keys with their catalogue defaults.
 *      Runs once per device, then never again.
 *   2. Per-load drift patch: insert any missing keys with their
 *      catalogue default (preserving analyst toggles for keys they
 *      already have).
 *
 * Also seeds the new top-level fields (headline, marketComment,
 * latestReports, yesterdayRecap) when the persisted state pre-dates
 * them.
 */
export function useSectionCatalogueSync(): void {
  useEffect(() => {
    const state = useDailyStore.getState();
    const persistedByKey = new Map<string, Section>(
      (state.sections || []).map((s) => [s.key, s]),
    );

    // First-load v3 resync (one-shot per device). Forces the three
    // keys back to their canonical default regardless of what's in
    // the persisted array. After this, the flag is set and we fall
    // through to the regular drift patch on every subsequent load.
    const needsV3Resync = (() => {
      try {
        return localStorage.getItem(V3_RESYNC_FLAG) !== "1";
      } catch {
        return false;
      }
    })();

    // Build the merged catalogue: every key from DEFAULT_STATE in the
    // canonical order, with the analyst's `on` flag preserved where
    // they already had that key — except on the v3 resync, where the
    // allow-list keys are forced to the catalogue default.
    const merged = DEFAULT_STATE.sections.map((s) => {
      if (needsV3Resync && V3_FORCE_REINTRODUCE.has(s.key)) return s;
      return persistedByKey.get(s.key) || s;
    });
    const missingCount = DEFAULT_STATE.sections.filter((s) => !persistedByKey.has(s.key)).length;

    // Detect drift: either keys are missing, or this is the v3
    // resync run. Calling setField unconditionally would create
    // needless rerenders and pollute zundo's undo history.
    if (missingCount > 0 || needsV3Resync) {
      state.setField("sections", merged);
    }

    if (needsV3Resync) {
      try {
        localStorage.setItem(V3_RESYNC_FLAG, "1");
      } catch {
        // Quota / disabled storage — non-fatal; we'll just retry
        // the same forced-reset next load. Idempotent.
      }
    }

    // Seed top-level fields the persisted shape might predate.
    // Use `??` so an analyst's intentionally-empty value isn't
    // overwritten with a default.
    if (state.headline === undefined) state.setField("headline", DEFAULT_STATE.headline);
    if (state.marketComment === undefined) state.setField("marketComment", DEFAULT_STATE.marketComment);
    if (state.latestReports === undefined) state.setField("latestReports", DEFAULT_STATE.latestReports);
    if (state.yesterdayRecap === undefined) state.setField("yesterdayRecap", DEFAULT_STATE.yesterdayRecap);
  }, []);
}
