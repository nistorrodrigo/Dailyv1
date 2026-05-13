import { describe, it, expect } from "vitest";
import { migrateState } from "../store/useDailyStore";
import { DEFAULT_STATE } from "../constants/defaultState";
import type { DailyStore } from "../store/slices/_helpers";

/**
 * Pin the hydration migration behaviour. The migration is shared
 * between the `migrate` callback (runs when persisted version < 3)
 * and the `merge` hook (runs every rehydration). It does three
 * independent things, each of which has a way to silently go wrong:
 *
 *   - merge the analyst's persisted `sections` array against the
 *     current `DEFAULT_STATE.sections` catalogue (so new sections
 *     appear, renamed labels propagate, V3_FORCE_REINTRODUCE keys
 *     get reset on pre-v3 hydration)
 *   - strip dead `snapshot` / `yesterdayRecap` persisted bloat so
 *     they don't keep round-tripping through localStorage
 *   - default-overlay everything else from `DEFAULT_STATE` so a
 *     null/undefined leaf doesn't crash downstream `.map` consumers
 */

describe("migrateState — section catalogue merge", () => {
  it("preserves the analyst's `on` choices for sections present in their persisted state", () => {
    const persisted = {
      sections: [
        { key: "macro", label: "Macro / Political", on: false },
        { key: "tradeIdeas", label: "Trade Ideas", on: true },
      ],
    } as unknown as Partial<DailyStore>;
    const out = migrateState(persisted, 3);
    expect(out).toBeDefined();
    const macroEntry = out!.sections!.find((s) => s.key === "macro");
    expect(macroEntry?.on).toBe(false);
    const tradeEntry = out!.sections!.find((s) => s.key === "tradeIdeas");
    expect(tradeEntry?.on).toBe(true);
  });

  it("inserts new catalogue sections that aren't in the persisted state (with their default `on`)", () => {
    const persisted = {
      sections: [{ key: "macro", label: "Macro / Political", on: true }],
    } as unknown as Partial<DailyStore>;
    const out = migrateState(persisted, 3);
    // Every key from the canonical catalogue should appear in the merged result.
    for (const def of DEFAULT_STATE.sections) {
      expect(out!.sections!.some((s) => s.key === def.key)).toBe(true);
    }
  });

  it("pulls labels from the canonical catalogue (so renames propagate)", () => {
    // Analyst has a stale label persisted; the migration should
    // replace it with the catalogue's current label.
    const persisted = {
      sections: [{ key: "events", label: "Upcoming", on: true }],
    } as unknown as Partial<DailyStore>;
    const out = migrateState(persisted, 3);
    const eventsEntry = out!.sections!.find((s) => s.key === "events");
    const catalogue = DEFAULT_STATE.sections.find((s) => s.key === "events");
    expect(eventsEntry?.label).toBe(catalogue?.label);
    // And the analyst's `on` value still wins.
    expect(eventsEntry?.on).toBe(true);
  });

  it("force-resets V3_FORCE_REINTRODUCE keys when version < 3 (one-shot recovery)", () => {
    // Analyst has `marketComment` toggled off and persisted at v2.
    // The pre-v3 migration should ignore their `on:false` and reset
    // it to the catalogue default.
    const persisted = {
      sections: [
        { key: "marketComment", label: "Market Comment", on: false },
        { key: "latestReports", label: "Latest Research", on: false },
      ],
    } as unknown as Partial<DailyStore>;
    const out = migrateState(persisted, 2);
    const mcEntry = out!.sections!.find((s) => s.key === "marketComment");
    const mcCatalogue = DEFAULT_STATE.sections.find((s) => s.key === "marketComment");
    expect(mcEntry?.on).toBe(mcCatalogue?.on);
  });

  it("does NOT force-reset V3_FORCE_REINTRODUCE keys when already at v3+ (no churn after recovery)", () => {
    const persisted = {
      sections: [{ key: "marketComment", label: "Market Comment", on: false }],
    } as unknown as Partial<DailyStore>;
    const out = migrateState(persisted, 3);
    const mcEntry = out!.sections!.find((s) => s.key === "marketComment");
    // Analyst's `on:false` should be preserved at v3+.
    expect(mcEntry?.on).toBe(false);
  });
});

describe("migrateState — deprecated-field strip", () => {
  it("strips persisted `snapshot` and rehydrates with the empty DEFAULT_STATE.snapshot", () => {
    // Old persisted state with real snapshot values from before the
    // Market Snapshot section was retired.
    const persisted = {
      snapshot: {
        merval: "1,500,000", mervalChg: "+2.5%",
        adrs: "stale", adrsChg: "+1%",
        sp500: "stale", sp500Chg: "+0.5%",
        ust10y: "stale", dxy: "stale", soja: "stale", wti: "stale",
        ccl: "stale", cclChg: "+1%", mep: "stale", mepChg: "+1%", blue: "stale",
      },
    } as unknown as Partial<DailyStore>;
    const out = migrateState(persisted, 3);
    // The stale string should be gone; default empty value takes over.
    expect(out!.snapshot?.merval).toBe(DEFAULT_STATE.snapshot.merval);
    expect(out!.snapshot?.merval).not.toBe("1,500,000");
  });

  it("strips persisted `yesterdayRecap` so a stale paragraph doesn't keep round-tripping", () => {
    const persisted = {
      yesterdayRecap: "Stale recap from before retirement",
    } as unknown as Partial<DailyStore>;
    const out = migrateState(persisted, 3);
    expect(out!.yesterdayRecap).toBe(DEFAULT_STATE.yesterdayRecap);
    expect(out!.yesterdayRecap).not.toContain("Stale");
  });
});

describe("migrateState — null/undefined clean-up", () => {
  it("treats a persisted `null` value as 'missing' and substitutes the DEFAULT_STATE value", () => {
    // A buggy server write or older persisted shape sometimes stored
    // `null` for fields the type says are required. Without the
    // clean-up step, the downstream `.map` / `.find` consumers crash.
    const persisted = {
      macroBlocks: null,
      equityPicks: null,
      analysts: null,
    } as unknown as Partial<DailyStore>;
    const out = migrateState(persisted, 3);
    expect(Array.isArray(out!.macroBlocks)).toBe(true);
    expect(Array.isArray(out!.equityPicks)).toBe(true);
    expect(Array.isArray(out!.analysts)).toBe(true);
  });

  it("returns undefined when given undefined (early-exit guard)", () => {
    expect(migrateState(undefined, 3)).toBeUndefined();
  });
});
