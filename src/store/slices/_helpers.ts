import type { StateCreator } from "zustand";
import type {
  DailyState,
  MacroBlock,
  CorpBlock,
  ResearchReport,
  Signature,
  Analyst,
  ChartImage,
} from "../../types";

// ════════════════════════════════════════════════════════════════════
//  Shared types
// ════════════════════════════════════════════════════════════════════

export type ListField =
  | "macroBlocks"
  | "corpBlocks"
  | "researchReports"
  | "signatures"
  | "analysts"
  | "equityPicks"
  | "fiIdeas";

export type MoverType = "gainers" | "losers";

/** Items that can be passed to `addListItem`. Union of every concrete
 *  type the generic CRUD path accepts. */
export type ListItem =
  | MacroBlock
  | CorpBlock
  | ResearchReport
  | Signature
  | Analyst;

/** Aggregate "Daily store" shape. Each slice file declares its own
 *  Actions interface; the main store assembles them all into this
 *  combined type so each slice's `set` / `get` see the full surface. */
export interface DailyActions {
  // Document
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

  // Content
  updateEquityPick: (index: number, key: string, value: string) => void;
  addEquityPick: () => void;
  removeEquityPick: (index: number) => void;
  updateFIIdea: (index: number, key: string, value: string) => void;
  addFIIdea: () => void;
  removeFIIdea: (index: number) => void;
  updateMacroRow: (index: number, field: string, value: string) => void;
  updateMacroRowValue: (index: number, col: string, value: string) => void;
  addMacroCol: () => void;
  removeMacroCol: (col: string) => void;
  addMacroRow: () => void;
  removeMacroRow: (index: number) => void;
  toggleSection: (key: string) => void;
  setSectionOn: (key: string, on: boolean) => void;
  moveSection: (from: number, to: number) => void;
  updateMover: (type: MoverType, index: number, key: string, value: string) => void;
  addMover: (type: MoverType) => void;
  removeMover: (type: MoverType, index: number) => void;
  addTweet: () => void;
  updateTweet: (index: number, key: string, value: string) => void;
  removeTweet: (index: number) => void;
  addEvent: () => void;
  updateEvent: (index: number, key: string, value: string) => void;
  removeEvent: (index: number) => void;
  addKeyEvent: () => void;
  updateKeyEvent: (index: number, key: string, value: string) => void;
  removeKeyEvent: (index: number) => void;

  // Widgets
  setChartImage: (img: ChartImage | null) => void;
  setBcraData: (data: Record<string, string> | null) => void;
  toggleBcraRow: (key: string) => void;
}

/** The `flows` field is technically part of DailyState but the type system
 *  treats it as an extension here for legacy reasons. Kept for parity
 *  with the pre-refactor store signature. */
export type DailyStore = DailyState & {
  flows: { global: string; local: string; positioning: string };
} & DailyActions;

/** Type alias for a slice creator under our combined DailyStore. Each
 *  slice exports a function of this shape; the main store assembles
 *  them together with spread. The third argument to `StateCreator`
 *  is the slice's *own* exposed surface — but at runtime each slice
 *  has access to the full store via `set` / `get`, which is what
 *  makes cross-slice action calls (e.g. `newDaily` reading `analysts`)
 *  work without ceremony. */
export type DailySliceCreator<TSlice> = StateCreator<DailyStore, [], [], TSlice>;

// ════════════════════════════════════════════════════════════════════
//  Pure list helpers
//  Re-exported across slices. Kept here so each slice doesn't reimport
//  identical 3-line utility fns from the components dir.
// ════════════════════════════════════════════════════════════════════

/** Replace the row at `i` with `{...row, [key]: value}`, return new array. */
export const updateAt = <T>(arr: T[], i: number, key: string, value: unknown): T[] => {
  const next = [...arr];
  next[i] = { ...next[i], [key]: value };
  return next;
};

/** Remove the row at `i`, return new array. */
export const removeAt = <T>(arr: T[], i: number): T[] => arr.filter((_, j) => j !== i);

/** Random short id with a domain prefix, e.g. "ep-lg5x7y3a". Used for
 *  client-side list items that don't get an id from the server (trade
 *  ideas, draft analysts, etc.). */
export const newId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
