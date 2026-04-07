import { describe, it, expect } from "vitest";
import { generateBBG } from "../utils/generateBBG";
import { DEFAULT_STATE } from "../constants/defaultState";

describe("generateBBG", () => {
  it("generates header with date and flag", () => {
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg).toContain("LS DAILY");
    expect(bbg).toContain("LS DAILY");
  });

  it("includes summary bar when set", () => {
    const state = { ...DEFAULT_STATE, summaryBar: "Market rallied on rate cut expectations" };
    const bbg = generateBBG(state);
    expect(bbg).toContain("Market rallied on rate cut expectations");
  });

  it("includes equity picks in compact format", () => {
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg).toContain("TOP PICKS");
    expect(bbg).toContain("BBAR");
  });

  it("includes FI ideas", () => {
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg).toContain("FI:");
    expect(bbg).toContain("ARGENT");
  });

  it("includes flows as buy/sell", () => {
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg).toContain("BUY:");
    expect(bbg).toContain("SELL:");
  });

  it("includes footer", () => {
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg).toContain("LS Research");
    expect(bbg).toContain("latinsecurities.com.ar");
  });

  it("does not include signatures", () => {
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg).not.toContain("Institutional Sales");
  });

  it("handles empty state gracefully", () => {
    const state = {
      ...DEFAULT_STATE,
      macroBlocks: [],
      equityPicks: [],
      fiIdeas: [],
      corpBlocks: [],
      researchReports: [],
      macroRows: [],
    };
    const bbg = generateBBG(state);
    expect(bbg).toContain("LS DAILY");
  });

  it("includes watch items when set", () => {
    const state = { ...DEFAULT_STATE, watchToday: ["BCRA auction at 11am"] };
    const bbg = generateBBG(state);
    expect(bbg).toContain("WHAT TO WATCH");
    expect(bbg).toContain("BCRA auction");
  });

  it("is compact (under 40 lines)", () => {
    const bbg = generateBBG(DEFAULT_STATE);
    const lines = bbg.split("\n").length;
    expect(lines).toBeLessThan(40);
  });
});
