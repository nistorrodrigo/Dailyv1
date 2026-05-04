import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { temporal } from "zundo";
import { DEFAULT_STATE, STORAGE_KEY } from "../constants/defaultState";
import type { Section } from "../types";
import type { DailyStore } from "./slices/_helpers";
import { createDocumentSlice } from "./slices/document";
import { createContentSlice } from "./slices/content";
import { createWidgetsSlice } from "./slices/widgets";

/**
 * Bring a hydrated state up to the current section catalogue.
 *
 * As we ship new section types (yesterdayRecap, marketComment,
 * latestReports, etc.), the analyst's localStorage still holds an
 * older `sections` array that doesn't contain the new keys —
 * meaning the new toggles never appear in SectionToggleList and
 * the new sections render as if they didn't exist.
 *
 * Run this every time the persisted state is rehydrated. We
 * iterate over `DEFAULT_STATE.sections` (the canonical current
 * catalogue), keeping the analyst's `on` value when their
 * persisted array already has that key, and inserting the new
 * default for any key they're missing. Order follows the default
 * catalogue so newly-added sections slot in at the position the
 * code intends, not "appended at the bottom".
 *
 * Also seeds defaults for newly-added scalar/list state fields
 * (headline, marketComment, latestReports, yesterdayRecap) when
 * a hydrated state is missing them — same reasoning, the
 * persisted shape pre-dates these fields.
 *
 * `version` is the persisted state's version. When it's below the
 * "force re-introduce" cutoff (3), a few specific keys we shipped
 * recently are forced back to their catalogue defaults — overriding
 * an analyst's previously-persisted entry. Necessary because some
 * users ended up with these keys persisted at `on:false` (or absent
 * after a buggy mid-version write), and the normal `||` merge
 * preserves that stale entry instead of reviving the section.
 * One-shot: gated by the version bump so it only fires on first
 * load after the update.
 */
const V3_FORCE_REINTRODUCE = new Set(["marketComment", "latestReports", "yesterdayRecap"]);

function migrateState(
  persisted: Partial<DailyStore> | undefined,
  version: number = 0,
): Partial<DailyStore> | undefined {
  if (!persisted) return persisted;

  // Section catalogue merge — normally preserve the analyst's `on`
  // choices, but force-reset a small allow-list of keys when this
  // migration is bringing them up from < v3 (one-time recovery for
  // the rollout where these toggles disappeared / silently flipped
  // off). At v3+ the force-reset is a no-op.
  const persistedByKey = new Map<string, Section>(
    (persisted.sections || []).map((s) => [s.key, s]),
  );
  const isPreV3 = version < 3;
  const mergedSections = DEFAULT_STATE.sections.map((s) => {
    if (isPreV3 && V3_FORCE_REINTRODUCE.has(s.key)) return s;
    return persistedByKey.get(s.key) || s;
  });

  return {
    ...persisted,
    sections: mergedSections,
    // Seed scalar/list fields the persisted shape might predate.
    // Only fill when the persisted value is `undefined` — preserve
    // empty strings / empty arrays the analyst may have explicitly
    // set.
    headline: persisted.headline ?? DEFAULT_STATE.headline,
    marketComment: persisted.marketComment ?? DEFAULT_STATE.marketComment,
    latestReports: persisted.latestReports ?? DEFAULT_STATE.latestReports,
    yesterdayRecap: persisted.yesterdayRecap ?? DEFAULT_STATE.yesterdayRecap,
  };
}

/**
 * The Daily document store. Composes three feature slices:
 *
 *   - `document` — meta-actions (setField, reset, newDaily) + generic
 *     id-based list CRUD + analyst-coverage accessors
 *   - `content`  — section toggles, trade ideas, macro estimates, top
 *     movers, tweets, events
 *   - `widgets`  — chart of the day + BCRA dashboard
 *
 * Middleware wiring (innermost → outermost):
 *
 *   1. `persist`   — writes to localStorage under STORAGE_KEY so the
 *                    draft survives a refresh.
 *   2. `devtools`  — Redux DevTools integration; named "DailyBuilder"
 *                    so it's easy to find when several Zustand stores
 *                    are loaded simultaneously.
 *   3. `temporal`  — zundo undo/redo. Limit: 50 past states. Wraps
 *                    the outermost so undo/redo also restores
 *                    devtools history correctly.
 *
 * Why this order: persist + devtools should see the same state, so
 * they sit together. temporal needs to wrap whatever it's undoing —
 * and we want undo/redo to roll back the persisted state too, so it
 * goes outside.
 */
const useDailyStore = create<DailyStore>()(
  temporal(
    devtools(
      persist(
        (...a) => ({
          // Seed from defaults. Each slice spread below overlays its
          // actions; the action keys never collide with state keys.
          ...DEFAULT_STATE,
          ...createDocumentSlice(...a),
          ...createContentSlice(...a),
          ...createWidgetsSlice(...a),
        }),
        {
          name: STORAGE_KEY,
          // Bump every time the section catalogue or top-level
          // schema gains a new key. The `migrate` callback runs
          // when the persisted version is below the current — and
          // also via the `merge` hook for already-up-to-date
          // states (in case a session pre-dates a section being
          // added without a version bump, like the marketComment /
          // latestReports / yesterdayRecap / headline additions
          // that landed at version 1).
          //
          // v3 is a one-time forced re-introduction of three
          // section toggles (marketComment, latestReports,
          // yesterdayRecap) that some analysts ended up with as
          // missing or persisted at on:false after the mid-version
          // shipment. See `migrateState` for the allow-list logic.
          version: 3,
          migrate: (persisted, version) =>
            migrateState(persisted as Partial<DailyStore> | undefined, version) as Partial<DailyStore>,
          // `merge` runs every rehydration regardless of version.
          // Defensive belt-and-braces: if a persisted state at the
          // current version is somehow missing a section we added
          // mid-version, the merge still patches it. We pass the
          // current version (3) so the v3 force-reset doesn't fire
          // on every page load — it's a one-shot, gated by the
          // version bump in `migrate`.
          merge: (persisted, current) => ({
            ...current,
            ...(migrateState(persisted as Partial<DailyStore> | undefined, 3) || {}),
          }),
        },
      ),
      { name: "DailyBuilder" },
    ),
    { limit: 50 },
  ),
);

export default useDailyStore;
