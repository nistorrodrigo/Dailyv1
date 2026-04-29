import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { temporal } from "zundo";
import { DEFAULT_STATE, STORAGE_KEY } from "../constants/defaultState";
import type {
  DailyState,
  MacroBlock,
  CorpBlock,
  ResearchReport,
  Signature,
  Analyst,
  ChartImage,
} from "../types";

// ════════════════════════════════════════════════════════════════════
//  TYPES
// ════════════════════════════════════════════════════════════════════

type ListField = "macroBlocks" | "corpBlocks" | "researchReports" | "signatures" | "analysts" | "equityPicks" | "fiIdeas";
type MoverType = "gainers" | "losers";

interface DailyActions {
  // ── General ──────────────────────────────────────────────────────
  setField: <K extends keyof DailyState>(field: K, value: DailyState[K]) => void;
  resetState: () => void;
  newDaily: () => void;

  // ── Generic id-based list CRUD (macroBlocks / corpBlocks / etc.) ──
  updateListItem: (field: ListField, id: string, key: string, value: unknown) => void;
  addListItem: (field: ListField, item: MacroBlock | CorpBlock | ResearchReport | Signature | Analyst) => void;
  removeListItem: (field: ListField, id: string) => void;
  reorderList: (field: ListField, from: number, to: number) => void;

  // ── Analyst coverage (nested under analysts[].coverage) ──────────
  updateCoverage: (analystId: string, coverageIndex: number, key: string, value: string) => void;
  addCoverage: (analystId: string) => void;
  deleteCoverage: (analystId: string, coverageIndex: number) => void;

  // ── Trade ideas (index-based for legacy reasons) ──────────────────
  updateEquityPick: (index: number, key: string, value: string) => void;
  addEquityPick: () => void;
  removeEquityPick: (index: number) => void;
  updateFIIdea: (index: number, key: string, value: string) => void;
  addFIIdea: () => void;
  removeFIIdea: (index: number) => void;

  // ── Macro estimates (rows × cols matrix) ─────────────────────────
  updateMacroRow: (index: number, field: string, value: string) => void;
  updateMacroRowValue: (index: number, col: string, value: string) => void;
  addMacroCol: () => void;
  removeMacroCol: (col: string) => void;
  addMacroRow: () => void;
  removeMacroRow: (index: number) => void;

  // ── Section toggles + reorder ────────────────────────────────────
  toggleSection: (key: string) => void;
  setSectionOn: (key: string, on: boolean) => void;
  moveSection: (from: number, to: number) => void;

  // ── Top movers (gainers/losers buckets) ──────────────────────────
  updateMover: (type: MoverType, index: number, key: string, value: string) => void;
  addMover: (type: MoverType) => void;
  removeMover: (type: MoverType, index: number) => void;

  // ── Tweets ───────────────────────────────────────────────────────
  addTweet: () => void;
  updateTweet: (index: number, key: string, value: string) => void;
  removeTweet: (index: number) => void;

  // ── Events + key events ──────────────────────────────────────────
  addEvent: () => void;
  updateEvent: (index: number, key: string, value: string) => void;
  removeEvent: (index: number) => void;
  addKeyEvent: () => void;
  updateKeyEvent: (index: number, key: string, value: string) => void;
  removeKeyEvent: (index: number) => void;

  // ── Widgets (chart, BCRA) ────────────────────────────────────────
  setChartImage: (img: ChartImage | null) => void;
  setBcraData: (data: Record<string, string> | null) => void;
  toggleBcraRow: (key: string) => void;
}

type DailyStore = DailyState & { flows: { global: string; local: string; positioning: string } } & DailyActions;

// ════════════════════════════════════════════════════════════════════
//  HELPERS
//  Pure functions that build new immutable arrays. Kept out of the
//  set() callbacks to make the action bodies one-liners.
// ════════════════════════════════════════════════════════════════════

/** Replace the row at `i` with `{...row, [key]: value}`, return new array. */
const updateAt = <T>(arr: T[], i: number, key: string, value: unknown): T[] => {
  const next = [...arr];
  next[i] = { ...next[i], [key]: value };
  return next;
};

/** Remove the row at `i`, return new array. */
const removeAt = <T>(arr: T[], i: number): T[] => arr.filter((_, j) => j !== i);

/** Random short id with a domain prefix, e.g. "ep-lg5x7y3a". */
const newId = (prefix: string): string => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

// ════════════════════════════════════════════════════════════════════
//  STORE
// ════════════════════════════════════════════════════════════════════

const useDailyStore = create<DailyStore>()(
  temporal(
    devtools(
      persist(
      (set, get) => ({
        // ── Seed state ──────────────────────────────────────────────
        ...DEFAULT_STATE,

        // ────────────────────────────────────────────────────────────
        //  General
        // ────────────────────────────────────────────────────────────
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
              analysts: prev.analysts,
              signatures: prev.signatures,
              date: new Date().toISOString().split("T")[0],
            });
          }
        },

        // ────────────────────────────────────────────────────────────
        //  Generic id-based list CRUD
        // ────────────────────────────────────────────────────────────
        updateListItem: (field, id, key, value) =>
          set((s) => ({
            [field]: (s[field] as Array<{ id: string }>).map((x) => (x.id === id ? { ...x, [key]: value } : x)),
          })),

        addListItem: (field, item) =>
          set((s) => ({ [field]: [...(s[field] as Array<unknown>), item] })),

        removeListItem: (field, id) =>
          set((s) => ({ [field]: (s[field] as Array<{ id: string }>).filter((x) => x.id !== id) })),

        reorderList: (field, from, to) =>
          set((s) => {
            const arr = [...s[field]];
            const [item] = arr.splice(from, 1);
            arr.splice(to, 0, item);
            return { [field]: arr } as Partial<DailyState>;
          }),

        // ────────────────────────────────────────────────────────────
        //  Analyst coverage (nested under analysts[i].coverage[j])
        // ────────────────────────────────────────────────────────────
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

        // ────────────────────────────────────────────────────────────
        //  Trade ideas — equityPicks + fiIdeas
        // ────────────────────────────────────────────────────────────
        updateEquityPick: (index, key, value) =>
          set((s) => ({ equityPicks: updateAt(s.equityPicks, index, key, value) })),
        addEquityPick: () =>
          set((s) => ({ equityPicks: [...s.equityPicks, { id: newId("ep"), ticker: "", reason: "" }] })),
        removeEquityPick: (index) =>
          set((s) => ({ equityPicks: removeAt(s.equityPicks, index) })),

        updateFIIdea: (index, key, value) =>
          set((s) => ({ fiIdeas: updateAt(s.fiIdeas, index, key, value) })),
        addFIIdea: () =>
          set((s) => ({ fiIdeas: [...s.fiIdeas, { id: newId("fi"), idea: "", reason: "" }] })),
        removeFIIdea: (index) =>
          set((s) => ({ fiIdeas: removeAt(s.fiIdeas, index) })),

        // ────────────────────────────────────────────────────────────
        //  Macro estimates — rows × cols matrix
        // ────────────────────────────────────────────────────────────
        updateMacroRow: (index, field, value) =>
          set((s) => ({ macroRows: updateAt(s.macroRows, index, field, value) })),

        updateMacroRowValue: (index, col, value) =>
          set((s) => {
            const a = [...s.macroRows];
            a[index] = { ...a[index], vals: { ...a[index].vals, [col]: value } };
            return { macroRows: a };
          }),

        addMacroCol: () => {
          const name = window.prompt("Column name (e.g. 2028)");
          if (name && !get().macroCols.includes(name)) {
            set((s) => ({ macroCols: [...s.macroCols, name] }));
          }
        },

        removeMacroCol: (col) =>
          set((s) => ({
            macroCols: s.macroCols.filter((c) => c !== col),
            macroRows: s.macroRows.map((r) => {
              const v = { ...r.vals };
              delete v[col];
              return { ...r, vals: v };
            }),
          })),

        addMacroRow: () =>
          set((s) => ({ macroRows: [...s.macroRows, { label: "", vals: {} }] })),

        removeMacroRow: (index) =>
          set((s) => ({ macroRows: removeAt(s.macroRows, index) })),

        // ────────────────────────────────────────────────────────────
        //  Section toggles + reorder
        // ────────────────────────────────────────────────────────────
        toggleSection: (key) =>
          set((s) => ({
            sections: s.sections.map((x) => (x.key === key ? { ...x, on: !x.on } : x)),
          })),

        setSectionOn: (key, on) =>
          set((s) => ({
            sections: s.sections.map((x) => (x.key === key ? { ...x, on } : x)),
          })),

        moveSection: (from, to) =>
          set((s) => {
            const a = [...s.sections];
            const [item] = a.splice(from, 1);
            a.splice(to, 0, item);
            return { sections: a };
          }),

        // ────────────────────────────────────────────────────────────
        //  Top movers — { gainers: Mover[]; losers: Mover[] }
        // ────────────────────────────────────────────────────────────
        updateMover: (type, index, key, value) =>
          set((s) => ({
            topMovers: { ...s.topMovers, [type]: updateAt(s.topMovers[type], index, key, value) },
          })),

        addMover: (type) =>
          set((s) => ({
            topMovers: { ...s.topMovers, [type]: [...s.topMovers[type], { ticker: "", chgPct: "", comment: "" }] },
          })),

        removeMover: (type, index) =>
          set((s) => ({
            topMovers: { ...s.topMovers, [type]: removeAt(s.topMovers[type], index) },
          })),

        // ────────────────────────────────────────────────────────────
        //  Tweets
        // ────────────────────────────────────────────────────────────
        addTweet: () =>
          set((s) => ({
            tweets: [...s.tweets, {
              content: "", link: "", time: "",
              sentiment: "Neutral" as const, impactType: "Market" as const, impactValue: "",
            }],
          })),

        updateTweet: (index, key, value) =>
          set((s) => ({ tweets: updateAt(s.tweets, index, key, value) })),

        removeTweet: (index) =>
          set((s) => ({ tweets: removeAt(s.tweets, index) })),

        // ────────────────────────────────────────────────────────────
        //  Events + key events
        // ────────────────────────────────────────────────────────────
        addEvent: () =>
          set((s) => ({
            events: [...s.events, {
              title: "", type: "Webinar" as const, date: "", timeET: "", timeBUE: "", timeLON: "",
              description: "", link: "",
            }],
          })),

        updateEvent: (index, key, value) =>
          set((s) => ({ events: updateAt(s.events, index, key, value) })),

        removeEvent: (index) =>
          set((s) => ({ events: removeAt(s.events, index) })),

        addKeyEvent: () =>
          set((s) => ({ keyEvents: [...s.keyEvents, { date: "", event: "" }] })),

        updateKeyEvent: (index, key, value) =>
          set((s) => ({ keyEvents: updateAt(s.keyEvents, index, key, value) })),

        removeKeyEvent: (index) =>
          set((s) => ({ keyEvents: removeAt(s.keyEvents, index) })),

        // ────────────────────────────────────────────────────────────
        //  Widgets — chart + BCRA dashboard
        // ────────────────────────────────────────────────────────────
        setChartImage: (img) => set({ chartImage: img }),

        setBcraData: (data) => set({ bcraData: data }),
        toggleBcraRow: (key) =>
          set((s) => ({
            bcraHiddenRows: { ...s.bcraHiddenRows, [key]: !s.bcraHiddenRows[key] },
          })),

      }),
      {
        name: STORAGE_KEY,
        version: 1,
      }
    ),
      { name: "DailyBuilder" }
    ),
    { limit: 50 }
  )
);

export default useDailyStore;
