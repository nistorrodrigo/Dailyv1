import { describe, it, expect } from "vitest";
import { formatDate, fmtEventDate, fmtTime, fmtRelativeTime, isToday, todayLocal, addDaysLocal } from "../utils/dates";
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

  it("fmtTime handles edge of day", () => {
    expect(fmtTime("00:00")).toBe("12:00 AM");
    expect(fmtTime("12:00")).toBe("12:00 PM");
    expect(fmtTime("23:59")).toBe("11:59 PM");
  });

  // Regression guards — previously these returned strings with
  // literal "undefined" or invalid hours that landed in rendered
  // emails. Now they cleanly return "" for malformed input.
  it("fmtTime returns '' for malformed input", () => {
    expect(fmtTime("morning")).toBe("");
    expect(fmtTime("8")).toBe("");           // missing minutes
    expect(fmtTime("8:")).toBe("");          // missing minutes
    expect(fmtTime(":30")).toBe("");         // missing hour
    expect(fmtTime("25:00")).toBe("");       // hour out of range
    expect(fmtTime("12:60")).toBe("12:60 PM"); // minute pattern matches, kept as-is (not parsed)
  });

  it("fmtTime accepts single-digit hour with leading zero or none", () => {
    expect(fmtTime("8:30")).toBe("8:30 AM");
    expect(fmtTime("08:30")).toBe("8:30 AM");
  });

  it("fmtEventDate handles empty / malformed", () => {
    expect(fmtEventDate("")).toBe("");
    expect(fmtEventDate(null as unknown as string)).toBe("");
    expect(fmtEventDate("not-a-date")).toBe("");
    expect(fmtEventDate("2026-13-99")).toBe("");
  });

  it("formatDate returns '' for malformed instead of 'Invalid Date'", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate(null as unknown as string)).toBe("");
    expect(formatDate("not-a-date")).toBe("");
    expect(formatDate("2026/04/05")).toBe("");  // wrong separator
  });

  it("fmtRelativeTime returns 'just now' for very recent timestamps", () => {
    const now = new Date("2026-04-30T12:00:00Z");
    const recent = new Date("2026-04-30T11:59:55Z").toISOString();
    expect(fmtRelativeTime(recent, now)).toBe("just now");
  });

  it("fmtRelativeTime renders seconds, minutes, and hours", () => {
    const now = new Date("2026-04-30T12:00:00Z");
    expect(fmtRelativeTime(new Date("2026-04-30T11:59:15Z").toISOString(), now)).toBe("45 seconds ago");
    expect(fmtRelativeTime(new Date("2026-04-30T11:55:00Z").toISOString(), now)).toBe("5 minutes ago");
    expect(fmtRelativeTime(new Date("2026-04-30T11:59:00Z").toISOString(), now)).toBe("1 minute ago");
    expect(fmtRelativeTime(new Date("2026-04-30T10:00:00Z").toISOString(), now)).toBe("2 hours ago");
    expect(fmtRelativeTime(new Date("2026-04-30T11:00:00Z").toISOString(), now)).toBe("1 hour ago");
  });

  it("fmtRelativeTime falls through to absolute date past 24h", () => {
    const now = new Date("2026-04-30T12:00:00Z");
    const old = new Date("2026-04-25T12:00:00Z").toISOString();
    const result = fmtRelativeTime(old, now);
    expect(result).not.toMatch(/ago/);
    expect(result.length).toBeGreaterThan(0);
  });

  it("fmtRelativeTime returns empty string for invalid input", () => {
    expect(fmtRelativeTime(null)).toBe("");
    expect(fmtRelativeTime(undefined)).toBe("");
    expect(fmtRelativeTime("")).toBe("");
    expect(fmtRelativeTime("not-a-date")).toBe("");
  });

  it("todayLocal returns YYYY-MM-DD for the local date", () => {
    // Use a UTC noon time so local-vs-UTC won't disagree on the day
    // for any reasonable timezone — keeps the test stable across CI
    // hosts in any region.
    const noon = new Date("2026-04-30T12:00:00Z");
    const result = todayLocal(noon);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    // The output should be "2026-04-30" everywhere from UTC-12 to UTC+12.
    expect(result).toBe("2026-04-30");
  });

  it("addDaysLocal shifts a YYYY-MM-DD date by N days", () => {
    expect(addDaysLocal("2026-04-30", -1)).toBe("2026-04-29");
    expect(addDaysLocal("2026-04-30", -7)).toBe("2026-04-23");
    expect(addDaysLocal("2026-04-30", 1)).toBe("2026-05-01");
    // Year and month boundaries — the noon anchor + setDate handles these.
    expect(addDaysLocal("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysLocal("2026-03-01", -1)).toBe("2026-02-28");
    // Leap year (2028 is divisible by 4 and not by 100).
    expect(addDaysLocal("2028-03-01", -1)).toBe("2028-02-29");
  });

  it("addDaysLocal returns empty string for invalid input", () => {
    expect(addDaysLocal("", 1)).toBe("");
    expect(addDaysLocal("not-a-date", 1)).toBe("");
    expect(addDaysLocal("2026/04/30", 1)).toBe("");
  });

  it("isToday matches the local date and rejects invalid input", () => {
    const noon = new Date("2026-04-30T12:00:00Z");
    expect(isToday("2026-04-30", noon)).toBe(true);
    expect(isToday("2026-04-29", noon)).toBe(false);
    expect(isToday("2026-05-01", noon)).toBe(false);
    expect(isToday(null, noon)).toBe(false);
    expect(isToday(undefined, noon)).toBe(false);
    expect(isToday("", noon)).toBe(false);
    expect(isToday("not-a-date", noon)).toBe(false);
    // Non-strict shapes that look like ISO must also be rejected.
    expect(isToday("2026-4-30", noon)).toBe(false);
    expect(isToday("2026/04/30", noon)).toBe(false);
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

  it("parsePrice ignores letters and currency symbols", () => {
    expect(parsePrice("ARS 1500")).toBe(1500);
    expect(parsePrice("£12.50")).toBe(12.5);
  });

  it("parsePrice returns null for non-numeric strings", () => {
    expect(parsePrice("--")).toBe(null);
    expect(parsePrice("N/A")).toBe(null);
  });

  // Regression guard for the LatAm-format 1000x bug. Before fix:
  // `parsePrice("US$1,750")` silently returned 1.75 because the
  // implementation stripped every non-digit/non-`.` char.
  it("parsePrice handles US thousands-comma separators", () => {
    expect(parsePrice("1,750")).toBe(1750);
    expect(parsePrice("US$1,750")).toBe(1750);
    expect(parsePrice("$1,750.25")).toBe(1750.25);
    expect(parsePrice("1,234,567")).toBe(1234567);
    expect(parsePrice("1,234,567.89")).toBe(1234567.89);
  });

  it("parsePrice handles LatAm/EU thousands-dot + decimal-comma", () => {
    // `"1.750"` alone is ambiguous (could be LatAm thousands or
    // US decimal) — defer to parseFloat which reads it as 1.75.
    // The disambiguation only kicks in when both `,` and `.` are
    // present (then rightmost wins as the decimal).
    expect(parsePrice("1.750")).toBe(1.75);            // parseFloat default
    expect(parsePrice("1.750,25")).toBe(1750.25);      // explicit LatAm
    expect(parsePrice("ARS 1.250,50")).toBe(1250.5);
    expect(parsePrice("12,5")).toBe(12.5);             // single-comma decimal
    expect(parsePrice("18,75")).toBe(18.75);
  });

  it("parsePrice bails on range / ambiguous input", () => {
    // Range like "$18-22" — silently returning 18 (or 22) misleads
    // the upside calculation. Better to surface as null and skip.
    expect(parsePrice("18-22")).toBe(null);
    expect(parsePrice("$18-22")).toBe(null);
  });

  it("parsePrice handles approximate / unicode prefixes", () => {
    expect(parsePrice("~22")).toBe(22);
    expect(parsePrice("≈18.50")).toBe(18.5);
  });

  it("calcUpside handles non-numeric inputs as null", () => {
    expect(calcUpside("--", "US$50.00")).toBe(null);
    expect(calcUpside("US$68.00", "N/A")).toBe(null);
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

  it("rc/rb fall back for unknown or empty rating", () => {
    expect(rc("")).toBe("#666");
    expect(rc("Garbage")).toBe("#666");
    expect(rb("")).toBe("#f5f5f5");
    expect(rb("Garbage")).toBe("#f5f5f5");
  });

  it("rc/rb are case-insensitive", () => {
    expect(rc("OVERWEIGHT")).toBe("#27864a");
    expect(rb("neutral")).toBe("#fff8e1");
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

  it("resolveCorporateBlock handles multiple tickers per block", () => {
    const analysts = [
      { id: "a1", name: "John", title: "Analyst", coverage: [
        { ticker: "VIST", rating: "Overweight" as const, tp: "US$68.00", last: "US$50.00" },
        { ticker: "YPF", rating: "Neutral" as const, tp: "US$30.00", last: "US$28.00" },
      ]},
    ];
    const block = { id: "b1", analystId: "a1", tickers: ["VIST", "YPF"], headline: "Both", body: "", link: "" };
    const result = resolveCorporateBlock(block, analysts);
    expect(result.covs).toHaveLength(2);
    expect(result.covs.map((c) => c.ticker)).toEqual(["VIST", "YPF"]);
    expect(result.covs[1].rating).toBe("Neutral");
  });

  it("resolveCorporateBlock falls back to legacy singular `ticker` field", () => {
    const analysts = [
      { id: "a1", name: "John", title: "Analyst", coverage: [
        { ticker: "VIST", rating: "Overweight" as const, tp: "US$68.00", last: "US$50.00" },
      ]},
    ];
    // Older state shape used a singular `ticker` instead of `tickers[]`.
    // The fallback only fires when `tickers` is missing/undefined (empty array is truthy).
    const block = { id: "b1", analystId: "a1", ticker: "VIST", headline: "Test", body: "", link: "" } as unknown as Parameters<typeof resolveCorporateBlock>[0];
    const result = resolveCorporateBlock(block, analysts);
    expect(result.tickers).toEqual(["VIST"]);
    expect(result.covs[0].rating).toBe("Overweight");
  });

  it("resolveCorporateBlock returns empty analyst when id is unknown", () => {
    const analysts = [
      { id: "a1", name: "John", title: "Analyst", coverage: [] },
    ];
    const block = { id: "b1", analystId: "missing", tickers: ["X"], headline: "", body: "", link: "" };
    const result = resolveCorporateBlock(block, analysts);
    expect(result.analyst).toBe("");
    // Ticker without coverage entry → empty rating/tp/last but ticker preserved.
    expect(result.covs[0]).toEqual({ ticker: "X", rating: "", tp: "", last: "" });
  });

  it("resolveCorporateBlock returns empty covs when no tickers", () => {
    const analysts = [
      { id: "a1", name: "John", title: "Analyst", coverage: [] },
    ];
    const block = { id: "b1", analystId: "a1", tickers: [] as string[], headline: "", body: "", link: "" };
    const result = resolveCorporateBlock(block, analysts);
    expect(result.covs).toEqual([]);
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

  it("mdToHtml wraps consecutive list items in <ul>", () => {
    const html = mdToHtml("- one\n- two\n- three");
    expect(html).toContain("<ul>");
    expect(html).toContain("</ul>");
    expect((html.match(/<li>/g) || []).length).toBe(3);
  });

  it("mdToHtml combines bold + italic + lines", () => {
    const html = mdToHtml("**bold** and *italic*\nsecond line");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<br>");
  });

  it("mdToHtml returns empty for null / empty input", () => {
    expect(mdToHtml(null)).toBe("");
    expect(mdToHtml(undefined)).toBe("");
    expect(mdToHtml("")).toBe("");
  });

  it("nl2br accepts undefined", () => {
    expect(nl2br(undefined)).toBe("");
  });
});
