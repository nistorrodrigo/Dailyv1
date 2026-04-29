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
    expect(bbg).toContain("FIXED INCOME");
    expect(bbg).toContain("ARGENT");
  });

  it("includes flows as buy/sell", () => {
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg).toContain("MARKET COLOR");
    expect(bbg).toMatch(/Buy:/);
    expect(bbg).toMatch(/Sell:/);
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

  it("is chat-friendly (well under Bloomberg IB ~5000 char limit)", () => {
    // The whole point of this format is to be sendable in a Bloomberg
    // chat — Instant Bloomberg caps messages around 5000 chars. Even a
    // populated daily should leave headroom for a few extra paragraphs.
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg.length).toBeLessThan(5000);
  });

  it("expands per-corporate detail when blocks are present", () => {
    // A previous version of generateBBG flattened every corp block into
    // "TICKER — Headline" on a single pipe-joined line, dropping rating,
    // TP, analyst, body. Verify those now show.
    const bbg = generateBBG(DEFAULT_STATE);
    expect(bbg).toContain("VIST — 4Q25 SNAPSHOT");
    // Rating + TP from the analyst's coverage table.
    expect(bbg).toContain("Overweight");
    expect(bbg).toContain("TP US$68.00");
    // Analyst name + title.
    expect(bbg).toContain("George Gasztowtt");
  });

  it("includes every macro block, not just the first", () => {
    const state = {
      ...DEFAULT_STATE,
      macroBlocks: [
        { id: "1", title: "AUCTION", body: "First block body", lsPick: "" },
        { id: "2", title: "FX", body: "Second block body", lsPick: "" },
        { id: "3", title: "POLICY", body: "Third block body", lsPick: "Bullish bonds" },
      ],
    };
    const bbg = generateBBG(state);
    expect(bbg).toContain("First block body");
    expect(bbg).toContain("Second block body");
    expect(bbg).toContain("Third block body");
    expect(bbg).toContain("Bullish bonds");
  });

  it("includes equity pick reasons when provided", () => {
    const state = {
      ...DEFAULT_STATE,
      equityPicks: [{ id: "ep-test", ticker: "BBAR", reason: "Q4 EPS beat consensus by 12%" }],
    };
    const bbg = generateBBG(state);
    expect(bbg).toContain("BBAR");
    expect(bbg).toContain("Q4 EPS beat");
  });

  it("renders news links under macro blocks when present", () => {
    const state = {
      ...DEFAULT_STATE,
      macroBlocks: [
        {
          id: "1",
          title: "RATES",
          body: "BCRA cut 100bp",
          lsPick: "",
          newsLinks: [
            { label: "Bloomberg", url: "https://bloomberg.com/news/x" },
            { label: "", url: "https://reuters.com/y" },
          ],
        },
      ],
    };
    const bbg = generateBBG(state);
    expect(bbg).toContain("Sources:");
    expect(bbg).toContain("Bloomberg — https://bloomberg.com/news/x");
    expect(bbg).toContain("https://reuters.com/y");
  });

  it("renders news links separately from the LS report link in corporate", () => {
    const state = {
      ...DEFAULT_STATE,
      corpBlocks: [
        {
          id: "c1",
          tickers: ["VIST"],
          headline: "Q4 results",
          analystId: "a1",
          body: "",
          link: "https://latinsecurities.com/report",
          newsLinks: [{ label: "FT", url: "https://ft.com/article" }],
        },
      ],
    };
    const bbg = generateBBG(state);
    expect(bbg).toContain("Full report: https://latinsecurities.com/report");
    expect(bbg).toContain("Sources:");
    expect(bbg).toContain("FT — https://ft.com/article");
  });
});
