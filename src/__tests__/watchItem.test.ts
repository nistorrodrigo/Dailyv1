import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { bueTimeToZones } from "../utils/dates";
import { generateHTML } from "../utils/generateHTML";
import { generateBBG } from "../utils/generateBBG";
import { migrateState } from "../store/useDailyStore";
import { DEFAULT_STATE } from "../constants/defaultState";
import type { DailyState, WatchItem } from "../types";
import type { DailyStore } from "../store/slices/_helpers";

/**
 * Coverage for the "What to Watch This Week" upgrade — `watchToday`
 * went from `string[]` to `WatchItem[]` (each bullet carries an
 * optional date + Buenos Aires time, with ET / London derived).
 *
 * Three independent things to pin:
 *   - `bueTimeToZones` — the BUE→ET/London conversion, including
 *     the DST behaviour (the whole reason the date is required)
 *   - the persisted `string[]` → `WatchItem[]` migration
 *   - the renderers (HTML + BBG) emitting the date/time prefix only
 *     when set, plain text otherwise
 */

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-21T12:00:00.000Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("bueTimeToZones — DST-correct conversion", () => {
  it("converts a summer (EDT / BST) BUE time", () => {
    // 2026-07-15: US is on EDT (UTC-4), London on BST (UTC+1).
    // BUE 11:00 (UTC-3) → 14:00 UTC → ET 10:00 AM → London 3:00 PM.
    const z = bueTimeToZones("11:00", "2026-07-15");
    expect(z).not.toBeNull();
    expect(z!.et).toBe("10:00 AM");
    expect(z!.london).toBe("3:00 PM");
  });

  it("converts a winter (EST / GMT) BUE time — same clock time, different result", () => {
    // 2026-01-15: US on EST (UTC-5), London on GMT (UTC+0).
    // BUE 11:00 → 14:00 UTC → ET 9:00 AM → London 2:00 PM.
    // The DST shift is exactly why `bueTimeToZones` needs the date.
    const z = bueTimeToZones("11:00", "2026-01-15");
    expect(z).not.toBeNull();
    expect(z!.et).toBe("9:00 AM");
    expect(z!.london).toBe("2:00 PM");
  });

  it("rolls a late-evening BUE time into the next UTC day correctly", () => {
    // BUE 23:00 on 2026-07-15 → 02:00 UTC on the 16th.
    // ET (EDT) = 10:00 PM same day; London (BST) = 3:00 AM next day.
    const z = bueTimeToZones("23:00", "2026-07-15");
    expect(z).not.toBeNull();
    expect(z!.et).toBe("10:00 PM");
    expect(z!.london).toBe("3:00 AM");
  });

  it("returns null for a missing or malformed time", () => {
    expect(bueTimeToZones("", "2026-07-15")).toBeNull();
    expect(bueTimeToZones(undefined, "2026-07-15")).toBeNull();
    expect(bueTimeToZones("25:00", "2026-07-15")).toBeNull();
    expect(bueTimeToZones("notatime", "2026-07-15")).toBeNull();
  });

  it("falls back to today's date when no date is supplied", () => {
    // System clock is pinned to 2026-05-21 (EDT / BST). Without a
    // date arg the conversion should still succeed using that.
    const z = bueTimeToZones("11:00");
    expect(z).not.toBeNull();
    expect(z!.et).toBe("10:00 AM");
  });
});

describe("watchToday migration — string[] → WatchItem[]", () => {
  it("wraps legacy bare-string bullets into { text }", () => {
    const persisted = {
      watchToday: ["BCRA auction", "Congress vote"],
    } as unknown as Partial<DailyStore>;
    const out = migrateState(persisted, 3);
    expect(out!.watchToday).toEqual([
      { text: "BCRA auction" },
      { text: "Congress vote" },
    ]);
  });

  it("leaves already-migrated WatchItem objects untouched", () => {
    const already: WatchItem[] = [
      { text: "BCRA auction", date: "2026-05-21", timeBUE: "11:00" },
    ];
    const out = migrateState(
      { watchToday: already } as unknown as Partial<DailyStore>,
      3,
    );
    expect(out!.watchToday).toEqual(already);
  });

  it("handles a mixed array (partial migration / hand-edited storage)", () => {
    const persisted = {
      watchToday: ["legacy string", { text: "new object", timeBUE: "09:00" }],
    } as unknown as Partial<DailyStore>;
    const out = migrateState(persisted, 3);
    expect(out!.watchToday).toEqual([
      { text: "legacy string" },
      { text: "new object", timeBUE: "09:00" },
    ]);
  });
});

function stateWithWatch(items: WatchItem[]): DailyState {
  return {
    ...DEFAULT_STATE,
    date: "2026-05-21",
    sections: DEFAULT_STATE.sections.map((s) =>
      s.key === "watchToday" ? { ...s, on: true } : s,
    ),
    watchToday: items,
  };
}

describe("WatchItem rendering — HTML", () => {
  it("renders a plain bullet (no date/time) as just the text", () => {
    const html = generateHTML(stateWithWatch([{ text: "Congress vote expected" }]));
    expect(html).toContain("What to Watch This Week");
    expect(html).toContain("Congress vote expected");
    // No ET / London parenthetical when there's no time.
    expect(html).not.toContain("ET ·");
  });

  it("renders the date + BUE time + derived ET/London for a timed bullet", () => {
    const html = generateHTML(stateWithWatch([
      { text: "BCRA auction", date: "2026-07-15", timeBUE: "11:00" },
    ]));
    expect(html).toContain("BCRA auction");
    expect(html).toContain("Jul 15, 2026");
    expect(html).toContain("11:00 AM BUE");
    // Derived zones — summer rates from the bueTimeToZones tests above.
    expect(html).toContain("10:00 AM ET");
    expect(html).toContain("3:00 PM London");
  });

  it("renders a date-only bullet without the time parenthetical", () => {
    const html = generateHTML(stateWithWatch([
      { text: "IMF mission arrives", date: "2026-07-15" },
    ]));
    expect(html).toContain("IMF mission arrives");
    expect(html).toContain("Jul 15, 2026");
    expect(html).not.toContain("ET ·");
  });

  it("skips bullets whose text is empty", () => {
    const html = generateHTML(stateWithWatch([
      { text: "" },
      { text: "Real bullet" },
    ]));
    expect(html).toContain("Real bullet");
  });
});

describe("WatchItem rendering — BBG", () => {
  it("prefixes a timed bullet with date + BUE + zones", () => {
    const bbg = generateBBG(stateWithWatch([
      { text: "BCRA auction", date: "2026-07-15", timeBUE: "11:00" },
    ]));
    expect(bbg).toContain("WHAT TO WATCH THIS WEEK");
    expect(bbg).toMatch(/Jul 15, 2026 · 11:00 AM BUE \(10:00 AM ET · 3:00 PM London\) — BCRA auction/);
  });

  it("renders a plain bullet with no prefix", () => {
    const bbg = generateBBG(stateWithWatch([{ text: "Congress vote expected" }]));
    expect(bbg).toContain("• Congress vote expected");
    expect(bbg).not.toContain("BUE");
  });
});
