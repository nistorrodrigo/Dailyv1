import { DEFAULT_STATE } from "../../constants/defaultState";
import type { DailyState } from "../../types";
import {
  type DailySliceCreator,
  type ListField,
  type ListItem,
  updateAt,
  removeAt,
} from "./_helpers";

/**
 * Document slice — the meta-actions that act on the daily as a whole
 * (setField / reset / newDaily) plus the generic id-based list CRUD
 * that several Sections share, plus the analyst → coverage nested
 * accessors.
 *
 * The generic CRUD path covers any field of `DailyState` whose value
 * is `Array<{ id: string }>`: macroBlocks, corpBlocks, researchReports,
 * signatures, analysts, equityPicks, fiIdeas. Coverage is special-cased
 * because it lives nested under `analysts[i].coverage[j]` and a generic
 * "update at path" helper would have been more complex than three
 * dedicated actions.
 */

export interface DocumentSlice {
  setField: <K extends keyof DailyState>(field: K, value: DailyState[K]) => void;
  resetState: () => void;
  newDaily: () => void;

  updateListItem: (field: ListField, id: string, key: string, value: unknown) => void;
  addListItem: (field: ListField, item: ListItem) => void;
  removeListItem: (field: ListField, id: string) => void;
  reorderList: (field: ListField, from: number, to: number) => void;

  updateCoverage: (analystId: string, coverageIndex: number, key: string, value: string) => void;
  addCoverage: (analystId: string) => void;
  deleteCoverage: (analystId: string, coverageIndex: number) => void;
}

export const createDocumentSlice: DailySliceCreator<DocumentSlice> = (set, get) => ({
  setField: (field, value) => set(() => ({ [field]: value })),

  resetState: () => {
    if (window.confirm("Reset all fields to defaults? This cannot be undone.")) {
      set({ ...DEFAULT_STATE });
    }
  },

  newDaily: () => {
    if (window.confirm("Start a new daily? Analyst database will be kept, content fields will be cleared.")) {
      const prev = get();
      set({
        ...DEFAULT_STATE,
        // Carry over the long-lived reference data — analyst coverage
        // takes hours to maintain, signatures are per-user. Everything
        // else (today's macro blocks, today's trade ideas, today's
        // earnings notes) gets wiped.
        analysts: prev.analysts,
        signatures: prev.signatures,
        date: new Date().toISOString().split("T")[0],
      });
    }
  },

  updateListItem: (field, id, key, value) =>
    set((s) => ({
      [field]: (s[field] as Array<{ id: string }>).map((x) =>
        x.id === id ? { ...x, [key]: value } : x,
      ),
    })),

  addListItem: (field, item) =>
    set((s) => ({ [field]: [...(s[field] as Array<unknown>), item] })),

  removeListItem: (field, id) =>
    set((s) => ({
      [field]: (s[field] as Array<{ id: string }>).filter((x) => x.id !== id),
    })),

  reorderList: (field, from, to) =>
    set((s) => {
      const arr = [...s[field]];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return { [field]: arr } as Partial<DailyState>;
    }),

  updateCoverage: (analystId, coverageIndex, key, value) =>
    set((s) => ({
      analysts: s.analysts.map((a) =>
        a.id === analystId
          ? { ...a, coverage: updateAt(a.coverage, coverageIndex, key, value) }
          : a,
      ),
    })),

  addCoverage: (analystId) =>
    set((s) => ({
      analysts: s.analysts.map((a) =>
        a.id === analystId
          ? { ...a, coverage: [...a.coverage, { ticker: "", rating: "Neutral" as const, tp: "" }] }
          : a,
      ),
    })),

  deleteCoverage: (analystId, coverageIndex) =>
    set((s) => ({
      analysts: s.analysts.map((a) =>
        a.id === analystId
          ? { ...a, coverage: removeAt(a.coverage, coverageIndex) }
          : a,
      ),
    })),
});
