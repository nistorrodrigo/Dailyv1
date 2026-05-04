import { describe, it, expect } from "vitest";
import { preflightDraft } from "../utils/preflightDraft";
import { DEFAULT_STATE } from "../constants/defaultState";
import type { Analyst, DailyState } from "../types";

const fixedNow = new Date("2026-04-30T12:00:00Z");
const dateForToday = "2026-04-30";

/** Build a state for testing. Reuses DEFAULT_STATE's shape so tests
 *  only declare what they care about. */
function makeState(overrides: Partial<typeof DEFAULT_STATE> = {}): DailyState {
  return { ...DEFAULT_STATE, date: dateForToday, ...overrides } as DailyState;
}

describe("preflightDraft", () => {
  it("flags a date that doesn't match today", () => {
    const state = makeState({ date: "2026-04-25" });
    const issues = preflightDraft(state, { context: "BCRA cut", includeNews: true }, fixedNow);
    expect(issues.find((i) => /not today|2026-04-25/i.test(i))).toBeDefined();
  });

  it("flags both empty context AND news off", () => {
    const state = makeState();
    const issues = preflightDraft(state, { context: "", includeNews: false }, fixedNow);
    expect(issues.find((i) => /no context typed.*news toggle is off/i.test(i))).toBeDefined();
  });

  it("does NOT flag context+news when context is provided", () => {
    const state = makeState();
    const issues = preflightDraft(state, { context: "BCRA cut by 100bps", includeNews: false }, fixedNow);
    expect(issues.find((i) => /no context typed/i.test(i))).toBeUndefined();
  });

  it("does NOT flag context+news when news is on", () => {
    const state = makeState();
    const issues = preflightDraft(state, { context: "", includeNews: true }, fixedNow);
    expect(issues.find((i) => /no context typed/i.test(i))).toBeUndefined();
  });

  it("flags missing analyst coverage", () => {
    const analystsWithoutCoverage: Analyst[] = [
      { id: "1", name: "Rodrigo", title: "Sales", coverage: [] },
    ];
    const state = makeState({ analysts: analystsWithoutCoverage });
    const issues = preflightDraft(state, { context: "x", includeNews: true }, fixedNow);
    expect(issues.find((i) => /no coverage tickers/i.test(i))).toBeDefined();
  });

  it("flags missing signatures", () => {
    const state = makeState({ signatures: [] });
    const issues = preflightDraft(state, { context: "x", includeNews: true }, fixedNow);
    expect(issues.find((i) => /no signatures/i.test(i))).toBeDefined();
  });

  it("returns clean for a fully-set-up draft", () => {
    const state = makeState({
      analysts: [
        {
          id: "1",
          name: "Rodrigo",
          title: "Sales",
          coverage: [{ ticker: "GGAL", rating: "Overweight", tp: "US$45" }],
        },
      ],
      signatures: [
        { id: "1", name: "Rodrigo Nistor", role: "Sales", email: "rodrigo@latinsecurities.ar" },
      ],
    });
    const issues = preflightDraft(state, { context: "BCRA cut", includeNews: true }, fixedNow);
    expect(issues).toEqual([]);
  });
});
