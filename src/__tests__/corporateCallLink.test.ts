import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateHTML } from "../utils/generateHTML";
import { generateBBG } from "../utils/generateBBG";
import { DEFAULT_STATE } from "../constants/defaultState";
import type { DailyState } from "../types";

/**
 * Render coverage for the Corporate block's conference-call link
 * (the `☎ Join call →` CTA + `☎ Call (DATETIME): URL` BBG line).
 * Shipped without tests; this file targets:
 *
 *   - URL present + dateTime → button renders, date label inline
 *   - URL present + no dateTime → button still renders, no label
 *   - dateTime present + no URL → nothing renders (URL is required)
 *   - URL is `javascript:` / blank → suppressed via safeUrl allowlist
 *   - dateTime is escaped (XSS guard) when it contains HTML metachars
 */

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-29T12:00:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

function stateWithCorp(corpBlock: Partial<DailyState["corpBlocks"][number]>): DailyState {
  return {
    ...DEFAULT_STATE,
    date: "2026-04-29",
    corpBlocks: [{
      id: "c1",
      tickers: ["TGS"],
      headline: "1Q26 Strong Beat",
      analystId: "a1",
      body: "Solid results across regulated and unregulated segments.",
      link: "",
      ...corpBlock,
    }],
  };
}

describe("Corporate conference call link — HTML", () => {
  it("renders the call CTA with the dateTime label when both are set", () => {
    const html = generateHTML(stateWithCorp({
      callUrl: "https://zoom.us/j/12345",
      callDateTime: "Live Wed May 7, 9 AM ET",
    }));
    expect(html).toContain("Join call");
    expect(html).toContain("Live Wed May 7, 9 AM ET");
    expect(html).toContain('href="https://zoom.us/j/12345"');
  });

  it("renders the CTA without a label when dateTime is empty", () => {
    const html = generateHTML(stateWithCorp({
      callUrl: "https://teams.microsoft.com/join/X",
      callDateTime: "",
    }));
    expect(html).toContain("Join call");
    expect(html).toContain('href="https://teams.microsoft.com/join/X"');
    // The dateTime span only renders when there's a value.
    expect(html).not.toContain(">Replay available</span>");
  });

  it("suppresses the CTA entirely when callUrl is empty even if dateTime is set", () => {
    const html = generateHTML(stateWithCorp({
      callUrl: "",
      callDateTime: "Wed May 7, 9 AM ET",
    }));
    expect(html).not.toContain("Join call");
    // The dateTime alone shouldn't leak into the output either —
    // the whole call block requires a URL.
    expect(html).not.toContain("Wed May 7, 9 AM ET");
  });

  it("rejects javascript: / data: URLs via safeUrl allowlist", () => {
    const html = generateHTML(stateWithCorp({
      callUrl: "javascript:alert(document.cookie)",
      callDateTime: "Live",
    }));
    // safeUrl returns "" for non-http(s) URLs → call block suppresses
    expect(html).not.toContain("Join call");
    expect(html).not.toContain("javascript:");
  });

  it("escapes HTML metachars in the dateTime label", () => {
    const html = generateHTML(stateWithCorp({
      callUrl: "https://zoom.us/j/12345",
      callDateTime: "<img src=x onerror=alert(1)>",
    }));
    expect(html).toContain("Join call");
    // The injection attempt is rendered as escaped text, not as
    // executable HTML.
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toMatch(/<img src=x onerror=alert\(1\)>/);
  });
});

describe("Corporate conference call link — BBG", () => {
  it("emits a ☎ Call line below the report link when set", () => {
    const bbg = generateBBG(stateWithCorp({
      callUrl: "https://zoom.us/j/12345",
      callDateTime: "Live Wed May 7, 9 AM ET",
      link: "https://research.latinsecurities.ar/tgs-1q26",
    }));
    // Report link comes first, call link below.
    const idxReport = bbg.indexOf("↗ Full report:");
    const idxCall = bbg.indexOf("☎ Call");
    expect(idxReport).toBeGreaterThan(-1);
    expect(idxCall).toBeGreaterThan(idxReport);
    expect(bbg).toContain("(Live Wed May 7, 9 AM ET)");
    expect(bbg).toContain("https://zoom.us/j/12345");
  });

  it("omits the parenthetical when dateTime is empty", () => {
    const bbg = generateBBG(stateWithCorp({
      callUrl: "https://teams.microsoft.com/join/X",
      callDateTime: "",
    }));
    expect(bbg).toContain("☎ Call:");
    // No empty parens like "☎ Call (): URL".
    expect(bbg).not.toContain("(): https");
    expect(bbg).not.toContain("()");
  });

  it("doesn't emit a call line when callUrl is empty", () => {
    const bbg = generateBBG(stateWithCorp({
      callUrl: "",
      callDateTime: "Wed May 7, 9 AM ET",
    }));
    expect(bbg).not.toContain("☎ Call");
  });
});
