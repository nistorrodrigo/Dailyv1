import { describe, it, expect } from "vitest";
import { carryForwardYesterday } from "../utils/carryForward";
import { DEFAULT_STATE } from "../constants/defaultState";

/** A "yesterday" state with content in every section, so we can
 *  assert what gets kept vs what gets wiped. Shape mirrors the real
 *  store; values are just markers ("YESTERDAY's prose") so any
 *  carry-forward bug is obvious in the diff. */
const yesterdayState = {
  ...DEFAULT_STATE,
  date: "2026-04-29",
  summaryBar: "YESTERDAY's summary line",
  watchToday: ["YESTERDAY's first watch", "YESTERDAY's second watch"],
  macroBlocks: [
    { id: "m1", title: "FX / BCRA", body: "YESTERDAY's macro body", lsPick: "YESTERDAY's pick" },
  ],
  equityPicks: [{ id: "ep-1", ticker: "GGAL", reason: "YESTERDAY's reason" }],
  fiIdeas: [{ id: "fi-1", idea: "YESTERDAY's idea", reason: "YESTERDAY's reason" }],
  events: [{ title: "YESTERDAY event", type: "Webinar" as const, date: "2026-04-29", timeET: "", timeBUE: "", timeLON: "", description: "", link: "" }],
  topMovers: { gainers: [{ ticker: "ALUA", chgPct: "5%", comment: "y" }], losers: [] },
  chartImage: { base64: "data:image/png;base64,iVBOR...", title: "YESTERDAY chart", caption: "y" },
  flows: { global: "YESTERDAY global", local: "YESTERDAY local", positioning: "YESTERDAY pos" },
};

describe("carryForwardYesterday", () => {
  const next = carryForwardYesterday(yesterdayState, "2026-04-30");

  it("sets the date to today", () => {
    expect(next.date).toBe("2026-04-30");
  });

  it("keeps long-lived structural fields", () => {
    expect(next.analysts).toBe(yesterdayState.analysts);
    expect(next.signatures).toBe(yesterdayState.signatures);
    expect(next.sections).toBe(yesterdayState.sections);
    expect(next.macroCols).toBe(yesterdayState.macroCols);
  });

  it("keeps macro block titles but wipes bodies", () => {
    expect(next.macroBlocks).toHaveLength(1);
    expect(next.macroBlocks[0].title).toBe("FX / BCRA");
    expect(next.macroBlocks[0].body).toBe("");
    expect(next.macroBlocks[0].lsPick).toBe("");
  });

  it("keeps equity-pick tickers but wipes rationales", () => {
    expect(next.equityPicks).toHaveLength(1);
    expect(next.equityPicks[0].ticker).toBe("GGAL");
    expect(next.equityPicks[0].reason).toBe("");
  });

  it("resets daily content (summary, watchToday, FI ideas, events, top movers, chart)", () => {
    expect(next.summaryBar).toBe("");
    expect(next.watchToday).toEqual(DEFAULT_STATE.watchToday);
    expect(next.fiIdeas).toEqual(DEFAULT_STATE.fiIdeas);
    expect(next.events).toEqual(DEFAULT_STATE.events);
    expect(next.topMovers).toEqual(DEFAULT_STATE.topMovers);
    expect(next.chartImage).toBeNull();
  });

  it("resets the flows extension fields", () => {
    expect(next.flows).toEqual({ global: "", local: "", positioning: "" });
  });

  it("does NOT mutate yesterday's state", () => {
    // Sanity: the macroBlocks transform should produce new objects,
    // not mutate the source. If we accidentally mutated, yesterday's
    // state would now show empty bodies too.
    expect(yesterdayState.macroBlocks[0].body).toBe("YESTERDAY's macro body");
    expect(yesterdayState.equityPicks[0].reason).toBe("YESTERDAY's reason");
  });
});
