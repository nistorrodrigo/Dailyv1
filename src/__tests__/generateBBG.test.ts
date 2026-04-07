import { describe, it, expect } from "vitest";
import { generateBBG } from "../utils/generateBBG";
import { DEFAULT_STATE } from "../constants/defaultState";

describe("generateBBG", () => {
  it("generates header with date and flag", () => {
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg).toContain("LATIN SECURITIES");
    expect(bbg).toContain("Argentina Daily");
  });

  it("includes enabled sections", () => {
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg).toContain("MACRO / POLITICAL");
    expect(bbg).toContain("TRADE IDEAS");
    expect(bbg).toContain("LS TRADING DESK FLOWS");
    expect(bbg).toContain("MACRO ESTIMATES");
    expect(bbg).toContain("CORPORATE");
  });

  it("excludes disabled sections", () => {
    const state = {
      ...DEFAULT_STATE,
      sections: DEFAULT_STATE.sections.map((s) =>
        s.key === "macro" ? { ...s, on: false } : s
      ),
    };
    const bbg = generateBBG(state);
    expect(bbg).not.toContain("MACRO / POLITICAL");
    expect(bbg).toContain("TRADE IDEAS");
  });

  it("includes equity picks with tickers", () => {
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg).toContain("BBAR");
    expect(bbg).toContain("VIST");
  });

  it("includes FI ideas", () => {
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg).toContain("Long ARGENT 35/38");
  });

  it("includes macro blocks", () => {
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg).toContain("TREASURY AUCTION RESULTS");
    expect(bbg).toContain("FX / BCRA");
  });

  it("includes flows data", () => {
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg).toContain("Buyer");
    expect(bbg).toContain("Seller");
  });

  it("includes macro estimates", () => {
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg).toContain("CPI");
    expect(bbg).toContain("GDP growth");
  });

  it("does not include signatures in BBG output", () => {
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg).not.toContain("Institutional Sales");
  });

  it("includes summary bar when set", () => {
    const state = { ...DEFAULT_STATE, summaryBar: "Market rallied on rate cut expectations" };
    const bbg = generateBBG(state);
    expect(bbg).toContain("Market rallied on rate cut expectations");
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
    expect(bbg).toContain("LATIN SECURITIES");
  });

  it("respects section order", () => {
    const state = {
      ...DEFAULT_STATE,
      sections: [
        { key: "flows", label: "LS Desk Flows", on: true },
        { key: "macro", label: "Macro / Political", on: true },
        ...DEFAULT_STATE.sections.filter((s) => s.key !== "flows" && s.key !== "macro"),
      ],
    };
    const bbg = generateBBG(state);
    const flowsIdx = bbg.indexOf("LS TRADING DESK FLOWS");
    const macroIdx = bbg.indexOf("MACRO / POLITICAL");
    expect(flowsIdx).toBeLessThan(macroIdx);
  });
});
