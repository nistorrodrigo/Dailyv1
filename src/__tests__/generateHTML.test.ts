import { describe, it, expect, beforeEach } from "vitest";
// Logos in email HTML are now absolute URLs to the deployed CDN
// (see ../utils/emailLogoUrl). No fetch/FileReader involved at
// HTML-generation time, so no mock needed — assertions check for
// the absolute URL directly.

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

  it("references logos via absolute URL (not relative path or base64)", () => {
    // Regression guard: previously the email used base64-inline
    // logos with a "/logo.png" relative-path fallback. The fallback
    // 404'd in every recipient's inbox (resolves against their mail
    // domain, not ours), and the base64 path raced with the user's
    // Send click before the prefetch warmed the cache. Absolute
    // URLs to the deployed CDN fix both.
    const html = generateHTML(DEFAULT_STATE);
    expect(html).toContain('src="https://dailyv1.vercel.app/logo-white.png"');
    expect(html).toContain('src="https://dailyv1.vercel.app/logo.png"');
    // Old anti-patterns we don't want to regress to:
    expect(html).not.toContain('src="/logo.png"');
    expect(html).not.toContain('src="/logo-white.png"');
    expect(html).not.toContain("data:image/png;base64");
  });

  it("uses explicit pixel dimensions on logos so Outlook doesn't clip them", () => {
    // Previously height:32px width:auto in the header — Outlook ignored
    // width:auto and rendered the intrinsic 400px-wide logo, clipping it.
    // Fix: explicit width AND height in both HTML attrs and inline style,
    // matching the logo's 3.98:1 aspect ratio (1600×402 source PNG).
    // Header → 180×45, signature → 120×30. The earlier 120×32 squashed
    // the signature glyphs ~6% vertically — analysts described it as
    // "looking cut off".
    const html = generateHTML(DEFAULT_STATE);
    expect(html).toContain('width="180"');
    expect(html).toContain('height="45"');
    expect(html).toContain("width:180px;height:45px");
    // Footer logo (smaller).
    expect(html).toContain('width="120"');
    expect(html).toContain('height="30"');
    // Old bugs we don't want to regress to.
    expect(html).not.toContain("opacity:0.6");
    expect(html).not.toContain("width:auto");
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

  it("includes an unsubscribe link in the footer with a substitution token", () => {
    const html = generateHTML(DEFAULT_STATE);
    expect(html).toContain("/api/unsubscribe");
    expect(html).toContain("Unsubscribe");
    // The token is what api/send-email.js replaces per recipient.
    expect(html).toContain("__LS_RECIPIENT_EMAIL__");
  });

  it("includes MSO conditional + Outlook-friendly meta tags", () => {
    const html = generateHTML(DEFAULT_STATE);
    expect(html).toContain('xmlns:o="urn:schemas-microsoft-com:office:office"');
    expect(html).toContain("<o:PixelsPerInch>96</o:PixelsPerInch>");
    expect(html).toContain('content="IE=edge"');
    expect(html).toContain('content="light only"'); // color-scheme guard
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
