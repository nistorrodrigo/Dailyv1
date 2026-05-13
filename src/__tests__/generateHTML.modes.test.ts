import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateHTML } from "../utils/generateHTML";
import { DEFAULT_STATE } from "../constants/defaultState";
import type { DailyState } from "../types";

/**
 * Coverage for the mode/template branches of generateHTML that
 * weren't exercised by any existing test. Added when `compactSummaries`
 * / `compactBlock` / `tocBlock` were moved inside their respective
 * branches (they used to be computed unconditionally outside the
 * if-else, which wasted ~10ms on every LivePreviewPanel keystroke).
 *
 * These tests pin the visible output of each branch so a future
 * refactor that breaks one of them (e.g. drops a label, changes a
 * section ordering, or wipes anchor links) fails loudly instead of
 * silently shipping a degraded preview/email.
 */

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-29T12:00:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

function stateWithContent(): DailyState {
  return {
    ...DEFAULT_STATE,
    date: "2026-04-29",
    summaryBar: "BCRA cut 100bp; bonds rallied across the curve.",
    macroBlocks: [{ id: "m1", title: "BCRA decision", body: "Cut by 100bp.", lsPick: "" }],
    equityPicks: [{ id: "ep1", ticker: "GGAL", reason: "ROE 25%." }],
    corpBlocks: [{ id: "c1", tickers: ["YPF"], headline: "1Q26 beat", analystId: "a1", body: "Strong quarter.", link: "" }],
  };
}

describe("generateHTML — compact mode", () => {
  it("renders the Summary header + a row per enabled section with content", () => {
    const html = generateHTML(stateWithContent(), "compact");
    expect(html).toContain("Summary");
    // Compact rows render the SEC_LABELS value (mixed case);
    // CSS `text-transform:uppercase` handles the visual uppercase.
    expect(html).toContain("Macro / Political");
    expect(html).toContain("Trade Ideas");
    // The one-line summaries themselves.
    expect(html).toContain("BCRA decision");
    expect(html).toContain("GGAL");
  });

  it("renders a 140px-wide label column (compact-row structural assertion)", () => {
    // Compact rows use a 140px label column — a refactor that drops
    // the table-cell layout (e.g. back to display:flex) would silently
    // regress Word/Outlook rendering, which doesn't honour flex.
    const html = generateHTML(stateWithContent(), "compact");
    expect(html).toContain("width:140px");
  });

  it("truncates marketComment to 80 chars + ellipsis", () => {
    const long = "x".repeat(100);
    const html = generateHTML({ ...DEFAULT_STATE, date: "2026-04-29", marketComment: long }, "compact");
    expect(html).toContain("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx…");
    // The full 100-char run shouldn't appear unbroken.
    expect(html).not.toContain("x".repeat(100));
  });
});

describe("generateHTML — toc mode", () => {
  it("renders the 'In This Issue' anchor list AND the full section bodies", () => {
    const html = generateHTML(stateWithContent(), "toc");
    expect(html).toContain("In This Issue");
    // Anchors point at #sec-{key}
    expect(html).toContain('href="#sec-macro"');
    expect(html).toContain('href="#sec-tradeIdeas"');
    // Full section bodies still render (toc = TOC + full content).
    expect(html).toContain("BCRA decision");
    expect(html).toContain("Cut by 100bp.");
  });

  it("orders TOC entries by enabled-sections order", () => {
    const html = generateHTML(stateWithContent(), "toc");
    const idxMacro = html.indexOf('href="#sec-macro"');
    const idxTrade = html.indexOf('href="#sec-tradeIdeas"');
    const idxCorp = html.indexOf('href="#sec-corporate"');
    expect(idxMacro).toBeGreaterThan(-1);
    expect(idxTrade).toBeGreaterThan(idxMacro);
    expect(idxCorp).toBeGreaterThan(idxTrade);
  });
});

describe("generateHTML — flash template", () => {
  it("only renders the flash-allowed keys (marketComment / watchToday / macro / tradeIdeas)", () => {
    const state: DailyState = {
      ...stateWithContent(),
      marketComment: "Risk-on tape into the close.",
      sections: DEFAULT_STATE.sections.map((s) =>
        ["marketComment", "macro", "tradeIdeas", "corporate"].includes(s.key) ? { ...s, on: true } : s,
      ),
    };
    const html = generateHTML(state, "full", "flash");
    expect(html).toContain("BCRA decision"); // macro
    expect(html).toContain("GGAL"); // trade ideas
    expect(html).toContain("Risk-on tape"); // market comment
    // Corporate is enabled in `sections` but NOT in the flash allowlist
    // — the YPF headline should be suppressed.
    expect(html).not.toContain("1Q26 beat");
  });
});

describe("generateHTML — executive template", () => {
  it("only renders the executive allowlist (macro / tradeIdeas / corporate)", () => {
    const state: DailyState = {
      ...stateWithContent(),
      marketComment: "Should NOT render in executive.",
      sections: DEFAULT_STATE.sections.map((s) =>
        ["marketComment", "macro", "tradeIdeas", "corporate"].includes(s.key) ? { ...s, on: true } : s,
      ),
    };
    const html = generateHTML(state, "full", "executive");
    expect(html).toContain("BCRA decision");
    expect(html).toContain("GGAL");
    expect(html).toContain("1Q26 beat");
    expect(html).not.toContain("Should NOT render in executive.");
  });
});
