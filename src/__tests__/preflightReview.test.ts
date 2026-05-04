import { describe, it, expect } from "vitest";
import { preflightReview } from "../utils/preflightReview";
import { DEFAULT_STATE } from "../constants/defaultState";

/** Mirror of the runtime shape preflightReview accepts (DailyState
 *  plus the optional flows extension that lives on the store). Match
 *  exactly the shape of DEFAULT_STATE which is the canonical seed. */
type StateForReview = typeof DEFAULT_STATE;

/** Build a state by applying targeted overrides on top of the default
 *  seeded one, so each test only declares what it cares about. */
function makeState(overrides: Partial<StateForReview> = {}): StateForReview {
  return { ...DEFAULT_STATE, ...overrides };
}

describe("preflightReview", () => {
  it("flags an empty Summary Bar", () => {
    const state = makeState({ summaryBar: "" });
    const issues = preflightReview(state);
    expect(issues).toEqual(expect.arrayContaining([expect.stringMatching(/Summary Bar/i)]));
  });

  it("does NOT flag Summary Bar when populated", () => {
    const state = makeState({ summaryBar: "Markets digest BCRA decision; equities flat." });
    const issues = preflightReview(state);
    expect(issues.find((i) => /Summary Bar/i.test(i))).toBeUndefined();
  });

  it("flags a macro block with title but no body", () => {
    const state = makeState({
      summaryBar: "x",
      macroBlocks: [{ id: "1", title: "FX / BCRA", body: "", lsPick: "" }],
    });
    const issues = preflightReview(state);
    expect(issues.find((i) => /FX \/ BCRA.*has no body/.test(i))).toBeDefined();
  });

  it("flags an equity pick with ticker but no rationale", () => {
    const state = makeState({
      summaryBar: "x",
      equityPicks: [{ id: "1", ticker: "GGAL", reason: "" }],
    });
    const issues = preflightReview(state);
    expect(issues.find((i) => /GGAL.*has no rationale/i.test(i))).toBeDefined();
  });

  it("flags Top Movers section toggled on but empty", () => {
    const state = makeState({
      summaryBar: "x",
      sections: DEFAULT_STATE.sections.map((s) =>
        s.key === "topMovers" ? { ...s, on: true } : s,
      ),
      topMovers: { gainers: [], losers: [] },
    });
    const issues = preflightReview(state);
    expect(issues.find((i) => /Top Movers/i.test(i))).toBeDefined();
  });

  it("does NOT flag Top Movers when section is off", () => {
    const state = makeState({
      summaryBar: "x",
      // topMovers is off by default
      topMovers: { gainers: [], losers: [] },
    });
    const issues = preflightReview(state);
    expect(issues.find((i) => /Top Movers/i.test(i))).toBeUndefined();
  });

  it("flags Trade Ideas toggled on but completely empty", () => {
    const state = makeState({
      summaryBar: "x",
      equityPicks: [],
      fiIdeas: [],
    });
    const issues = preflightReview(state);
    expect(issues.find((i) => /Trade Ideas/i.test(i))).toBeDefined();
  });

  it("flags missing signature email when all signatures are bare", () => {
    const state = makeState({
      summaryBar: "x",
      signatures: [
        { id: "1", name: "Rodrigo", role: "Sales", email: "" },
        { id: "2", name: "Pia", role: "Trading", email: "" },
      ],
    });
    const issues = preflightReview(state);
    expect(issues.find((i) => /signatures.*missing email/i.test(i))).toBeDefined();
  });

  it("returns no issues for a structurally complete daily", () => {
    const state = makeState({
      summaryBar: "Markets digest BCRA decision; equities flat.",
      macroBlocks: [
        { id: "1", title: "FX / BCRA", body: "BCRA cut by 100bps. Reserves stable.", lsPick: "Long ARGENT 35" },
      ],
      equityPicks: [{ id: "1", ticker: "GGAL", reason: "1Q earnings beat, NIM expansion" }],
      fiIdeas: [{ id: "1", idea: "Long ARGENT 35", reason: "Yield premium vs peers" }],
      flows: { global: "USD bid", local: "Two-way", positioning: "Balanced" },
      corpBlocks: [
        { id: "1", tickers: ["YPF"], headline: "YPF 1Q", analystId: "a1", body: "Beat on production", link: "", newsLinks: [] },
      ],
      watchToday: ["BCRA decision at 5pm", "Treasury auction"],
      signatures: [{ id: "1", name: "Rodrigo Nistor", role: "Sales", email: "rodrigo@latinsecurities.ar" }],
    });
    const issues = preflightReview(state);
    expect(issues).toEqual([]);
  });
});
