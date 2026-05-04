import { DEFAULT_STATE } from "../constants/defaultState";
import type { DailyState } from "../types";

/** Runtime store shape — DailyState plus the `flows` extension that
 *  lives on the Zustand store but isn't on the bare DailyState type.
 *  Mirrors the shape DEFAULT_STATE is typed as. See
 *  src/store/slices/_helpers.ts for the canonical compose. */
type StateWithFlows = DailyState & {
  flows: { global: string; local: string; positioning: string };
};

/**
 * Build today's draft state by carrying forward only the long-lived
 * structural fields from yesterday's daily — analyst DB, signatures,
 * section toggles, macro estimates layout — and resetting everything
 * that's genuinely new each day (bodies, prices, events, summary).
 *
 * The previous "duplicate yesterday" behaviour copied EVERYTHING and
 * relied on the analyst to remember to update each section. In
 * practice that's how today's review came back flagging "draft is
 * practically identical to yesterday's" — the analyst forgot to
 * refresh the macro bodies.
 *
 * Carry-forward principle: a field is preserved if its half-life is
 * longer than a day. Coverage takes hours to build and rarely
 * changes; section ordering is preference; macro-estimates columns
 * are quarterly. Everything else (today's events, today's prices,
 * today's narrative) gets reset.
 *
 * Macro-block TITLES are kept (the recurring sections "FX / BCRA",
 * "Treasury auction results", "Inflation data" tend to repeat) but
 * their BODIES are wiped so the analyst can't accidentally ship
 * yesterday's prose. Same with equity picks: tickers stay (you
 * usually pitch the same names for a few days), rationales reset.
 * FI ideas reset entirely — those change too quickly to assume
 * carry-over.
 */
export function carryForwardYesterday(
  yesterday: StateWithFlows,
  today: string,
): StateWithFlows {
  const seed = DEFAULT_STATE;

  return {
    // Start from defaults — that's the "everything daily is reset"
    // baseline. Then we selectively overlay what's safe to carry.
    ...seed,
    date: today,

    // ── Long-lived reference data (changes weekly+) ─────────────
    analysts: yesterday.analysts,
    signatures: yesterday.signatures,
    sections: yesterday.sections,

    // ── Macro estimates: structure carries, values too because
    //    rows are quarterly forecasts, not daily prints. The
    //    analyst overrides individual cells when REM updates.
    macroCols: yesterday.macroCols,
    macroRows: yesterday.macroRows,
    macroSource: yesterday.macroSource,

    // ── Section toggles + display preferences ────────────────────
    showEquity: yesterday.showEquity,
    showFI: yesterday.showFI,

    // ── Macro blocks: keep titles + LS-pick stub, wipe body so the
    //    analyst can't ship yesterday's prose. newsLinks reset
    //    because those are headline-of-the-day type content.
    macroBlocks: yesterday.macroBlocks.map((b) => ({
      ...b,
      body: "",
      lsPick: "",
      newsLinks: [],
    })),

    // ── Equity picks: tickers stay (you typically pitch the same
    //    names for several days), rationales reset.
    equityPicks: yesterday.equityPicks.map((p) => ({
      ...p,
      reason: "",
    })),

    // ── Everything below is daily content — explicitly reset to
    //    the default-state values so the seed spread above wins.
    summaryBar: seed.summaryBar,
    fiIdeas: seed.fiIdeas,
    eqBuyer: seed.eqBuyer,
    eqSeller: seed.eqSeller,
    fiBuyer: seed.fiBuyer,
    fiSeller: seed.fiSeller,
    watchToday: seed.watchToday,
    corpBlocks: seed.corpBlocks,
    researchReports: seed.researchReports,
    events: seed.events,
    keyEvents: seed.keyEvents,
    tweets: seed.tweets,
    topMovers: seed.topMovers,
    chartImage: seed.chartImage,
    bcraData: seed.bcraData,
    bcraHiddenRows: seed.bcraHiddenRows,
    snapshot: seed.snapshot,
    cclRate: seed.cclRate,

    // flows (the desk-colour notes block — global / local /
    // positioning) is daily commentary, reset alongside the rest.
    flows: seed.flows,
  };
}
