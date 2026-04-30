import {
  type DailySliceCreator,
  type MoverType,
  updateAt,
  removeAt,
  newId,
} from "./_helpers";

/**
 * Content slice — section-specific accessors that don't fit the generic
 * id-based list CRUD path. Most of these are index-based for legacy
 * reasons (the data shapes pre-date the id convention) or have nested
 * structures (top movers' gainers/losers buckets, macro estimates'
 * row × column matrix).
 *
 * Sections covered: section toggles + reorder, trade ideas (equity
 * picks + FI ideas), macro estimates, top movers, tweets, events,
 * and key events. The grouping is by "where it shows up in the
 * Editor tab" rather than by data shape — the goal is "go to the
 * file with the action you need" navigation.
 */

export interface ContentSlice {
  // Trade ideas (index-based, no per-row id on legacy schema)
  updateEquityPick: (index: number, key: string, value: string) => void;
  addEquityPick: () => void;
  removeEquityPick: (index: number) => void;
  updateFIIdea: (index: number, key: string, value: string) => void;
  addFIIdea: () => void;
  removeFIIdea: (index: number) => void;

  // Macro estimates (rows × cols matrix)
  updateMacroRow: (index: number, field: string, value: string) => void;
  updateMacroRowValue: (index: number, col: string, value: string) => void;
  addMacroCol: () => void;
  removeMacroCol: (col: string) => void;
  addMacroRow: () => void;
  removeMacroRow: (index: number) => void;

  // Section toggles + reorder
  toggleSection: (key: string) => void;
  setSectionOn: (key: string, on: boolean) => void;
  moveSection: (from: number, to: number) => void;

  // Top movers (gainers/losers buckets)
  updateMover: (type: MoverType, index: number, key: string, value: string) => void;
  addMover: (type: MoverType) => void;
  removeMover: (type: MoverType, index: number) => void;

  // Tweets
  addTweet: () => void;
  updateTweet: (index: number, key: string, value: string) => void;
  removeTweet: (index: number) => void;

  // Events + key events
  addEvent: () => void;
  updateEvent: (index: number, key: string, value: string) => void;
  removeEvent: (index: number) => void;
  addKeyEvent: () => void;
  updateKeyEvent: (index: number, key: string, value: string) => void;
  removeKeyEvent: (index: number) => void;
}

export const createContentSlice: DailySliceCreator<ContentSlice> = (set, get) => ({
  // ── Trade ideas ────────────────────────────────────────────────
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

  // ── Macro estimates ────────────────────────────────────────────
  updateMacroRow: (index, field, value) =>
    set((s) => ({ macroRows: updateAt(s.macroRows, index, field, value) })),

  updateMacroRowValue: (index, col, value) =>
    set((s) => {
      const a = [...s.macroRows];
      a[index] = { ...a[index], vals: { ...a[index].vals, [col]: value } };
      return { macroRows: a };
    }),

  addMacroCol: () => {
    // window.prompt is the simplest way to ask for a column header
    // without bringing in a dialog component just for this. Kept as-is
    // through the refactor — if/when we replace it, this is the only
    // call site to update.
    const name = window.prompt("Column name (e.g. 2028)");
    if (name && !get().macroCols.includes(name)) {
      set((s) => ({ macroCols: [...s.macroCols, name] }));
    }
  },

  removeMacroCol: (col) =>
    set((s) => ({
      macroCols: s.macroCols.filter((c) => c !== col),
      // Strip the value at this column key from every row so the data
      // and column headers stay in lock-step.
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

  // ── Section toggles + reorder ──────────────────────────────────
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

  // ── Top movers ─────────────────────────────────────────────────
  updateMover: (type, index, key, value) =>
    set((s) => ({
      topMovers: { ...s.topMovers, [type]: updateAt(s.topMovers[type], index, key, value) },
    })),

  addMover: (type) =>
    set((s) => ({
      topMovers: {
        ...s.topMovers,
        [type]: [...s.topMovers[type], { ticker: "", chgPct: "", comment: "" }],
      },
    })),

  removeMover: (type, index) =>
    set((s) => ({
      topMovers: { ...s.topMovers, [type]: removeAt(s.topMovers[type], index) },
    })),

  // ── Tweets ─────────────────────────────────────────────────────
  addTweet: () =>
    set((s) => ({
      tweets: [
        ...s.tweets,
        {
          content: "",
          link: "",
          time: "",
          sentiment: "Neutral" as const,
          impactType: "Market" as const,
          impactValue: "",
        },
      ],
    })),

  updateTweet: (index, key, value) =>
    set((s) => ({ tweets: updateAt(s.tweets, index, key, value) })),

  removeTweet: (index) =>
    set((s) => ({ tweets: removeAt(s.tweets, index) })),

  // ── Events + key events ────────────────────────────────────────
  addEvent: () =>
    set((s) => ({
      events: [
        ...s.events,
        {
          title: "",
          type: "Webinar" as const,
          date: "",
          timeET: "",
          timeBUE: "",
          timeLON: "",
          description: "",
          link: "",
        },
      ],
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
});
