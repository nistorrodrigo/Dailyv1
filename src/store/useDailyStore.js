import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { temporal } from "zundo";
import { DEFAULT_STATE, DEFAULT_ANALYSTS, STORAGE_KEY } from "../constants/defaultState";

const useDailyStore = create(
  temporal(
    devtools(
      persist(
      (set, get) => ({
        // === State ===
        ...DEFAULT_STATE,

        // === General actions ===
        setField: (field, value) => set((s) => ({ [field]: value })),

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

        // === List item actions ===
        updateListItem: (field, id, key, value) =>
          set((s) => ({
            [field]: s[field].map((x) => (x.id === id ? { ...x, [key]: value } : x)),
          })),

        addListItem: (field, item) =>
          set((s) => ({ [field]: [...s[field], item] })),

        removeListItem: (field, id) =>
          set((s) => ({ [field]: s[field].filter((x) => x.id !== id) })),

        // === Analyst coverage actions ===
        updateCoverage: (analystId, coverageIndex, key, value) =>
          set((s) => ({
            analysts: s.analysts.map((a) =>
              a.id === analystId
                ? { ...a, coverage: a.coverage.map((c, i) => (i === coverageIndex ? { ...c, [key]: value } : c)) }
                : a
            ),
          })),

        addCoverage: (analystId) =>
          set((s) => ({
            analysts: s.analysts.map((a) =>
              a.id === analystId
                ? { ...a, coverage: [...a.coverage, { ticker: "", rating: "Neutral", tp: "" }] }
                : a
            ),
          })),

        deleteCoverage: (analystId, coverageIndex) =>
          set((s) => ({
            analysts: s.analysts.map((a) =>
              a.id === analystId
                ? { ...a, coverage: a.coverage.filter((_, i) => i !== coverageIndex) }
                : a
            ),
          })),

        // === Equity picks ===
        updateEquityPick: (index, key, value) =>
          set((s) => {
            const a = [...s.equityPicks];
            a[index] = { ...a[index], [key]: value };
            return { equityPicks: a };
          }),

        addEquityPick: () =>
          set((s) => ({ equityPicks: [...s.equityPicks, { ticker: "", reason: "" }] })),

        removeEquityPick: (index) =>
          set((s) => ({ equityPicks: s.equityPicks.filter((_, i) => i !== index) })),

        // === FI ideas ===
        updateFIIdea: (index, key, value) =>
          set((s) => {
            const a = [...s.fiIdeas];
            a[index] = { ...a[index], [key]: value };
            return { fiIdeas: a };
          }),

        addFIIdea: () =>
          set((s) => ({ fiIdeas: [...s.fiIdeas, { idea: "", reason: "" }] })),

        removeFIIdea: (index) =>
          set((s) => ({ fiIdeas: s.fiIdeas.filter((_, i) => i !== index) })),

        // === Macro estimates ===
        updateMacroRow: (index, field, value) =>
          set((s) => {
            const a = [...s.macroRows];
            a[index] = { ...a[index], [field]: value };
            return { macroRows: a };
          }),

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
          set((s) => ({ macroRows: s.macroRows.filter((_, i) => i !== index) })),

        // === Sections ===
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

        // === Top Movers ===
        updateMover: (type, index, key, value) =>
          set((s) => ({
            topMovers: {
              ...s.topMovers,
              [type]: s.topMovers[type].map((m, i) => (i === index ? { ...m, [key]: value } : m)),
            },
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
            topMovers: {
              ...s.topMovers,
              [type]: s.topMovers[type].filter((_, i) => i !== index),
            },
          })),

        // === Tweets ===
        addTweet: () =>
          set((s) => ({
            tweets: [...s.tweets, {
              content: "", link: "", time: "",
              sentiment: "Neutral", impactType: "Market", impactValue: "",
            }],
          })),

        updateTweet: (index, key, value) =>
          set((s) => {
            const a = [...s.tweets];
            a[index] = { ...a[index], [key]: value };
            return { tweets: a };
          }),

        removeTweet: (index) =>
          set((s) => ({ tweets: s.tweets.filter((_, i) => i !== index) })),

        // === Events ===
        addEvent: () =>
          set((s) => ({
            events: [...s.events, {
              title: "", type: "Data Release", date: "", timeET: "", timeBUE: "", timeLON: "",
              description: "", link: "",
            }],
          })),

        updateEvent: (index, key, value) =>
          set((s) => {
            const a = [...s.events];
            a[index] = { ...a[index], [key]: value };
            return { events: a };
          }),

        removeEvent: (index) =>
          set((s) => ({ events: s.events.filter((_, i) => i !== index) })),

        // === Key Events ===
        addKeyEvent: () =>
          set((s) => ({ keyEvents: [...s.keyEvents, { date: "", event: "" }] })),

        updateKeyEvent: (index, key, value) =>
          set((s) => {
            const a = [...s.keyEvents];
            a[index] = { ...a[index], [key]: value };
            return { keyEvents: a };
          }),

        removeKeyEvent: (index) =>
          set((s) => ({ keyEvents: s.keyEvents.filter((_, i) => i !== index) })),

        // === Chart ===
        setChartImage: (img) => set({ chartImage: img }),

        // === BCRA ===
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
