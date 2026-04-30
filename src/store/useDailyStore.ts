import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { temporal } from "zundo";
import { DEFAULT_STATE, STORAGE_KEY } from "../constants/defaultState";
import type { DailyStore } from "./slices/_helpers";
import { createDocumentSlice } from "./slices/document";
import { createContentSlice } from "./slices/content";
import { createWidgetsSlice } from "./slices/widgets";

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
          version: 1,
        },
      ),
      { name: "DailyBuilder" },
    ),
    { limit: 50 },
  ),
);

export default useDailyStore;
