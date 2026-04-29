import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the logos module since it uses fetch/FileReader
vi.mock("../constants/logos", () => ({
  getLogoWhiteB64: () => "mock-white-logo",
  getLogoOrigB64: () => "mock-orig-logo",
}));

import { generateHTML } from "../utils/generateHTML";
import { DEFAULT_STATE } from "../constants/defaultState";

describe("generateHTML", () => {
  it("generates valid HTML document", () => {
    const html = generateHTML(DEFAULT_STATE);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
    expect(html).toContain("<body");
  });

  it("includes email-safe table layout", () => {
    const html = generateHTML(DEFAULT_STATE);
    expect(html).toContain('role="presentation"');
    expect(html).toContain("width=\"640\"");
  });

  it("includes brand elements", () => {
    const html = generateHTML(DEFAULT_STATE);
    expect(html).toContain("Argentina Daily");
    expect(html).toContain("Latin Securities");
    expect(html).toContain("Sales &amp; Trading");
  });

  it("includes enabled sections", () => {
    const html = generateHTML(DEFAULT_STATE);
    expect(html).toContain("Macro / Political");
    expect(html).toContain("Trade Ideas");
    expect(html).toContain("LS Trading Desk Flows");
  });

  it("excludes disabled sections", () => {
    const state = {
      ...DEFAULT_STATE,
      sections: DEFAULT_STATE.sections.map((s) =>
        s.key === "macro" ? { ...s, on: false } : s
      ),
    };
    const html = generateHTML(state);
    expect(html).not.toContain(">Macro / Political<");
    expect(html).toContain("Trade Ideas");
  });

  it("includes equity picks with rating badges", () => {
    const html = generateHTML(DEFAULT_STATE);
    expect(html).toContain("BBAR");
    expect(html).toContain("VIST");
  });

  it("includes corporate section with coverage data", () => {
    const html = generateHTML(DEFAULT_STATE);
    expect(html).toContain("Corporate");
    expect(html).toContain("4Q25 SNAPSHOT");
  });

  it("includes signature block", () => {
    const html = generateHTML(DEFAULT_STATE);
    expect(html).toContain("Rodrigo Nistor");
    expect(html).toContain("rodrigo.nistor@latinsecurities.ar");
  });

  it("includes footer disclaimer", () => {
    const html = generateHTML(DEFAULT_STATE);
    expect(html).toContain("informational purposes");
    expect(html).toContain("Latin Securities S.A.");
  });

  it("includes summary bar when set", () => {
    const state = { ...DEFAULT_STATE, summaryBar: "Bonds up 2% on IMF deal" };
    const html = generateHTML(state);
    expect(html).toContain("Bonds up 2% on IMF deal");
    expect(html).toContain("Today");
  });

  it("omits summary bar when empty", () => {
    const html = generateHTML(DEFAULT_STATE);
    expect(html).not.toContain("Bonds up");
  });

  it("handles empty sections gracefully", () => {
    const state = {
      ...DEFAULT_STATE,
      macroBlocks: [],
      equityPicks: [],
      fiIdeas: [],
      corpBlocks: [],
    };
    const html = generateHTML(state);
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("uses mock logos", () => {
    const html = generateHTML(DEFAULT_STATE);
    expect(html).toContain("mock-white-logo");
    expect(html).toContain("mock-orig-logo");
  });

  it("renders bigger header logo (48px) and visible footer logo (32px, no opacity)", () => {
    // Previously 32px header / 22px footer with opacity:0.6 — too small to read.
    const html = generateHTML(DEFAULT_STATE);
    expect(html).toContain("height:48px");
    expect(html).toContain("height:32px");
    expect(html).not.toContain("opacity:0.6");
  });

  it("renders news links under macro blocks", () => {
    const state = {
      ...DEFAULT_STATE,
      macroBlocks: [
        {
          id: "1",
          title: "POLICY",
          body: "Cabinet reshuffle",
          lsPick: "",
          newsLinks: [
            { label: "Bloomberg", url: "https://bloomberg.com/x" },
            { label: "", url: "https://reuters.com/y" },
          ],
        },
      ],
    };
    const html = generateHTML(state);
    expect(html).toContain("Sources");
    expect(html).toContain('href="https://bloomberg.com/x"');
    expect(html).toContain("Bloomberg ↗");
    // Empty label falls back to hostname.
    expect(html).toContain("reuters.com");
  });

  it("renders news links separately from the LS report link in corporate", () => {
    const state = {
      ...DEFAULT_STATE,
      corpBlocks: [
        {
          id: "c1",
          tickers: ["VIST"],
          headline: "Q4",
          analystId: "a1",
          body: "",
          link: "https://latinsecurities.com/report",
          newsLinks: [{ label: "FT", url: "https://ft.com/a" }],
        },
      ],
    };
    const html = generateHTML(state);
    expect(html).toContain("Full report &#8594;");
    expect(html).toContain("Sources");
    expect(html).toContain('href="https://ft.com/a"');
  });

  it("ignores news links with empty URLs (defensive)", () => {
    const state = {
      ...DEFAULT_STATE,
      macroBlocks: [
        {
          id: "1", title: "T", body: "B", lsPick: "",
          newsLinks: [{ label: "Empty", url: "" }, { label: "  ", url: "   " }],
        },
      ],
    };
    const html = generateHTML(state);
    expect(html).not.toContain("Sources");
  });
});
