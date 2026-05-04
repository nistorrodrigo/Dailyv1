import { useEffect } from "react";
import useDailyStore from "../store/useDailyStore";
import { DEFAULT_STATE } from "../constants/defaultState";
import type { Section } from "../types";

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
 * already equals the current).
 *
 * This hook runs once on App mount, compares the live `sections`
 * array against the catalogue, and merges in any missing entries
 * (preserving the analyst's `on` flag for keys they already had).
 * Independent of persist's version semantics — runs every load,
 * costs nothing when the array is already complete.
 *
 * Also seeds the new top-level fields (headline, marketComment,
 * latestReports, yesterdayRecap) when the persisted state pre-dates
 * them. Same reasoning: persist's migrate may have missed them on
 * a stale version.
 */
export function useSectionCatalogueSync(): void {
  useEffect(() => {
    const state = useDailyStore.getState();
    const persistedByKey = new Map<string, Section>(
      (state.sections || []).map((s) => [s.key, s]),
    );

    // Build the merged catalogue: every key from DEFAULT_STATE in the
    // canonical order, with the analyst's `on` flag preserved where
    // they already had that key. Detect missing keys by checking if
    // the persisted map already has the key.
    const merged = DEFAULT_STATE.sections.map((s) => persistedByKey.get(s.key) || s);
    const missingCount = DEFAULT_STATE.sections.filter((s) => !persistedByKey.has(s.key)).length;

    // Patch sections only when there's actual drift — calling setField
    // every mount would create needless rerenders and pollute zundo's
    // undo history with no-op transitions.
    if (missingCount > 0) {
      state.setField("sections", merged);
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
