import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateHTML } from "../utils/generateHTML";
import { generateBBG } from "../utils/generateBBG";
import { DEFAULT_STATE } from "../constants/defaultState";
import type { DailyState } from "../types";

/**
 * Render-correctness coverage for the Bond Pipeline section. The
 * full output goes through generateHTML/generateBBG snapshot tests
 * but those don't toggle Bond Pipeline on by default, so its specific
 * rendering paths were entirely untested. This file targets:
 *
 *   - the empty-issuer filter (analysts add a placeholder row then
 *     leave it; we don't want it in the output)
 *   - the `pricingDate` falsey → "TBD" fallback
 *   - the `estimatedSize` falsey → em-dash fallback
 *   - the table-row order: Issuer · Pricing · Size
 *   - BBG bullet format (column-separated string)
 *   - the section's on/off toggle is honoured
 */

// Pin the wall clock so the footer `© <year>` is stable across
// year-rollover.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-29T12:00:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

function stateWith(overrides: Partial<DailyState>): DailyState {
  const enableBondPipeline = (DEFAULT_STATE.sections || []).map((s) =>
    s.key === "bondPipeline" ? { ...s, on: true } : s,
  );
  return {
    ...DEFAULT_STATE,
    date: "2026-04-29",
    sections: enableBondPipeline,
    ...overrides,
  };
}

describe("Bond Pipeline — HTML render", () => {
  it("renders a 3-column table with issuer / pricing / size", () => {
    const html = generateHTML(stateWith({
      bondPipeline: [{
        id: "bp-1",
        issuer: "Tecpetrol",
        pricingDate: "2026-05-12",
        estimatedSize: "USD 500M",
      }],
    }));
    expect(html).toContain("Bond Pipeline");
    expect(html).toContain("Tecpetrol");
    expect(html).toContain("USD 500M");
    // fmtEventDate uses en-US "May 12, 2026" format.
    expect(html).toContain("May 12, 2026");
    // Order in row: Issuer comes before Pricing comes before Size.
    const idxIssuer = html.indexOf("Tecpetrol");
    const idxDate = html.indexOf("May 12, 2026");
    const idxSize = html.indexOf("USD 500M");
    expect(idxIssuer).toBeLessThan(idxDate);
    expect(idxDate).toBeLessThan(idxSize);
  });

  it("renders 'TBD' for rows without a pricing date", () => {
    const html = generateHTML(stateWith({
      bondPipeline: [{ id: "bp-1", issuer: "YPF", estimatedSize: "TBD" }],
    }));
    expect(html).toContain("YPF");
    expect(html).toContain("TBD");
  });

  it("renders em-dash for rows without an estimated size", () => {
    const html = generateHTML(stateWith({
      bondPipeline: [{ id: "bp-1", issuer: "BCRA", pricingDate: "2026-05-15", estimatedSize: "" }],
    }));
    expect(html).toContain("BCRA");
    // The em-dash fallback for missing size.
    expect(html).toContain("—");
  });

  it("filters out rows with no issuer", () => {
    const html = generateHTML(stateWith({
      bondPipeline: [
        { id: "bp-1", issuer: "", pricingDate: "2026-05-12", estimatedSize: "USD 500M" },
        { id: "bp-2", issuer: "Pampa Energía", pricingDate: "2026-05-15", estimatedSize: "USD 300M" },
      ],
    }));
    // The empty-issuer row's size must not appear; the populated
    // one does.
    expect(html).not.toContain("USD 500M");
    expect(html).toContain("Pampa Energía");
    expect(html).toContain("USD 300M");
  });

  it("omits the section entirely when toggled off", () => {
    const state = {
      ...DEFAULT_STATE,
      date: "2026-04-29",
      sections: (DEFAULT_STATE.sections || []).map((s) =>
        s.key === "bondPipeline" ? { ...s, on: false } : s,
      ),
      bondPipeline: [{
        id: "bp-1",
        issuer: "Tecpetrol",
        pricingDate: "2026-05-12",
        estimatedSize: "USD 500M",
      }],
    };
    const html = generateHTML(state);
    expect(html).not.toContain("Tecpetrol");
    expect(html).not.toContain("Bond Pipeline");
  });
});

describe("Bond Pipeline — BBG render", () => {
  it("renders one bullet per deal in 'Issuer · Pricing · Size' format", () => {
    const bbg = generateBBG(stateWith({
      bondPipeline: [
        { id: "bp-1", issuer: "Tecpetrol", pricingDate: "2026-05-12", estimatedSize: "USD 500M" },
        { id: "bp-2", issuer: "YPF", estimatedSize: "TBD" },
      ],
    }));
    expect(bbg).toContain("BOND PIPELINE");
    expect(bbg).toMatch(/• Tecpetrol · May 12, 2026 · USD 500M/);
    expect(bbg).toMatch(/• YPF · TBD · TBD/);
  });

  it("omits the section when toggled off", () => {
    const bbg = generateBBG({
      ...DEFAULT_STATE,
      date: "2026-04-29",
      sections: (DEFAULT_STATE.sections || []).map((s) =>
        s.key === "bondPipeline" ? { ...s, on: false } : s,
      ),
      bondPipeline: [{ id: "bp-1", issuer: "Tecpetrol", pricingDate: "2026-05-12", estimatedSize: "USD 500M" }],
    });
    expect(bbg).not.toContain("BOND PIPELINE");
    expect(bbg).not.toContain("Tecpetrol");
  });
});
