import { describe, it, expect } from "vitest";
import { formatDate, fmtEventDate, fmtTime } from "../utils/dates";
import { parsePrice, calcUpside, fmtUpside, upsideColor } from "../utils/prices";
import { rc, rb, resolveCorporateBlock } from "../utils/ratings";
import { nl2br, mdToHtml } from "../utils/text";

describe("dates", () => {
  it("formatDate formats ISO to long date", () => {
    const result = formatDate("2026-04-05");
    expect(result).toContain("2026");
    expect(result).toContain("April");
    expect(result).toContain("5");
  });

  it("fmtEventDate formats to short date", () => {
    const result = fmtEventDate("2026-04-05");
    expect(result).toContain("Apr");
    expect(result).toContain("5");
  });

  it("fmtTime converts 24h to 12h", () => {
    expect(fmtTime("14:30")).toBe("2:30 PM");
    expect(fmtTime("09:00")).toBe("9:00 AM");
  });

  it("fmtTime handles empty", () => {
    expect(fmtTime("")).toBe("");
    expect(fmtTime(null as unknown as string)).toBe("");
  });
});

describe("prices", () => {
  it("parsePrice extracts number", () => {
    expect(parsePrice("US$68.00")).toBe(68);
    expect(parsePrice("$45.50")).toBe(45.5);
    expect(parsePrice("100")).toBe(100);
    expect(parsePrice(null as unknown as string)).toBe(null);
    expect(parsePrice("")).toBe(null);
  });

  it("calcUpside computes percentage", () => {
    expect(calcUpside("US$68.00", "US$50.00")).toBeCloseTo(36, 0);
    expect(calcUpside("US$50.00", "US$50.00")).toBe(0);
    expect(calcUpside("US$40.00", "US$50.00")).toBeCloseTo(-20, 0);
  });

  it("calcUpside returns null for missing values", () => {
    expect(calcUpside(null as unknown as string, "US$50.00")).toBe(null);
    expect(calcUpside("US$68.00", null as unknown as string)).toBe(null);
    expect(calcUpside("US$68.00", "US$0.00")).toBe(null);
  });

  it("fmtUpside formats positive", () => {
    const result = fmtUpside("US$68.00", "US$50.00");
    expect(result).toContain("Upside");
    expect(result).toContain("+");
  });

  it("fmtUpside formats negative", () => {
    const result = fmtUpside("US$40.00", "US$50.00");
    expect(result).toContain("Downside");
  });

  it("upsideColor returns green for positive", () => {
    expect(upsideColor("US$68.00", "US$50.00")).toBe("#27864a");
  });

  it("upsideColor returns red for negative", () => {
    expect(upsideColor("US$40.00", "US$50.00")).toBe("#c0392b");
  });
});

describe("ratings", () => {
  it("rc returns correct colors", () => {
    expect(rc("Overweight")).toBe("#27864a");
    expect(rc("Neutral")).toBe("#e6a817");
    expect(rc("Underweight")).toBe("#c0392b");
    expect(rc("NR")).toBe("#888");
    expect(rc("UR")).toBe("#7b5ea7");
  });

  it("rb returns correct backgrounds", () => {
    expect(rb("Overweight")).toBe("#e8f5e9");
    expect(rb("Neutral")).toBe("#fff8e1");
    expect(rb("Underweight")).toBe("#fbe9e7");
  });

  it("resolveCorporateBlock resolves coverage", () => {
    const analysts = [
      { id: "a1", name: "John", title: "Analyst", coverage: [
        { ticker: "VIST", rating: "Overweight" as const, tp: "US$68.00", last: "US$50.00" },
      ]},
    ];
    const block = { id: "b1", analystId: "a1", tickers: ["VIST"], headline: "Test", body: "body", link: "" };
    const result = resolveCorporateBlock(block, analysts);
    expect(result.analyst).toBe("John, Analyst");
    expect(result.covs[0].ticker).toBe("VIST");
    expect(result.covs[0].rating).toBe("Overweight");
  });
});

describe("text", () => {
  it("nl2br converts newlines to br tags", () => {
    expect(nl2br("line1\nline2")).toBe("line1<br>line2");
    expect(nl2br("")).toBe("");
    expect(nl2br(null)).toBe("");
  });

  it("mdToHtml converts bold", () => {
    expect(mdToHtml("**bold**")).toContain("<strong>bold</strong>");
  });

  it("mdToHtml converts italic", () => {
    expect(mdToHtml("*italic*")).toContain("<em>italic</em>");
  });
});
