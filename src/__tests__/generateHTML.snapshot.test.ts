import { describe, it, expect } from "vitest";
// Logos in email HTML are absolute URLs (see ../utils/emailLogoUrl)
// so snapshots stay small naturally — no mock needed and no risk
// of 16 KB base64 noise in the snap file.

import { generateHTML } from "../utils/generateHTML";
import { generateBBG } from "../utils/generateBBG";
import { DEFAULT_STATE } from "../constants/defaultState";
import type { DailyState } from "../types";

/**
 * Snapshot tests for the email outputs.
 *
 * Why these exist: HTML email rendering is full of fragile bits — MSO
 * conditionals, Outlook-friendly attributes, exact inline-style strings,
 * substitution tokens that backend code (api/send-email.js) needs to
 * find verbatim. A snapshot catches regressions like "lost the
 * width=180 attr" or "renamed __LS_RECIPIENT_EMAIL__ token without
 * updating send-email.js" with one failed test instead of twenty.
 *
 * `formatDate(s.date)` would normally make these dynamic, so we pin
 * the date to a fixed value to keep snapshots deterministic.
 */

const STABLE_DATE = "2026-04-29";

/** Build a deterministic state for snapshotting. */
function makeState(overrides: Partial<DailyState> = {}): DailyState {
  return {
    ...DEFAULT_STATE,
    date: STABLE_DATE,
    ...overrides,
  };
}

describe("generateHTML snapshot", () => {
  it("default-state HTML matches snapshot", () => {
    const html = generateHTML(makeState());
    expect(html).toMatchSnapshot();
  });

  it("HTML with summary bar matches snapshot", () => {
    const html = generateHTML(makeState({ summaryBar: "BCRA cut 100bp; bonds rallied across the curve." }));
    expect(html).toMatchSnapshot();
  });

  it("HTML with macro block + news links matches snapshot", () => {
    const html = generateHTML(makeState({
      macroBlocks: [
        {
          id: "m1",
          title: "RATES",
          body: "BCRA delivered a 100bp cut today, bringing the policy rate to 28%.",
          lsPick: "Long the long end of the BONCAP curve.",
          newsLinks: [
            { label: "Bloomberg", url: "https://bloomberg.com/news/x" },
            { label: "", url: "https://reuters.com/article" },
          ],
        },
      ],
    }));
    expect(html).toMatchSnapshot();
  });
});

describe("generateBBG snapshot", () => {
  it("default-state BBG matches snapshot", () => {
    const bbg = generateBBG(makeState());
    expect(bbg).toMatchSnapshot();
  });

  it("populated BBG with macro/picks/corporate matches snapshot", () => {
    const bbg = generateBBG(makeState({
      summaryBar: "Quiet open, eyes on the auction at 11am.",
      macroBlocks: [{
        id: "m1", title: "AUCTION", body: "Treasury rolls 95% of maturing debt.", lsPick: "",
      }],
      equityPicks: [{ id: "ep1", ticker: "BBAR", reason: "Q4 EPS beat consensus by 12%" }],
    }));
    expect(bbg).toMatchSnapshot();
  });
});
