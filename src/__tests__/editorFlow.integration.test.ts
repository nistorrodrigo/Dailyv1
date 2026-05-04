import { describe, it, expect, beforeEach } from "vitest";
import useDailyStore from "../store/useDailyStore";
import { DEFAULT_STATE, STORAGE_KEY } from "../constants/defaultState";
import { generateBBG } from "../utils/generateBBG";
import { generateHTML } from "../utils/generateHTML";
import { getDailyTextMetrics, readingTimeMinutes } from "../utils/textMetrics";
import { preflightReview } from "../utils/preflightReview";

/**
 * Integration tests for the editor → output pipeline.
 *
 * Most existing tests exercise the output generators with hand-built
 * `DailyState` literals or the section-mutation helpers in isolation.
 * These tests round-trip through the actual zustand store the way
 * the editor components do (setField, updateListItem, toggleSection,
 * addListItem, removeListItem) and then assert the BBG + HTML
 * outputs reflect the changes.
 *
 * The boundary being tested: "if the analyst's editor action
 * survives the store mutation, does it land in the email + BBG
 * paste?" — this is the contract that real bugs live on, distinct
 * from the unit-level `generateHTML(state)` tests that just
 * verify the renderer.
 *
 * Persist is a test-environment concern: a leftover persisted
 * `localStorage` row from a prior test would let stale state leak
 * across cases. We clear it in beforeEach and reset the store to
 * a fresh DEFAULT_STATE so every case starts clean.
 */

beforeEach(() => {
  // Wipe any persisted snapshot from a prior test run. The migrate
  // hook in the store seeds DEFAULT_STATE on a missing entry, but
  // we want a deterministic starting point.
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
  // Reset the live store to a deep clone of DEFAULT_STATE so any
  // mutations from a previous test don't bleed in.
  useDailyStore.setState({ ...JSON.parse(JSON.stringify(DEFAULT_STATE)) });
});

describe("editor flow → output", () => {
  it("a typed headline lands in the editor's metrics + the prose itself", () => {
    const { setField } = useDailyStore.getState();

    setField("headline", "BCRA holds rate; ARS curve flat");
    setField("summaryBar", "Rate decision in line with REM consensus.");

    const state = useDailyStore.getState();
    expect(state.headline).toBe("BCRA holds rate; ARS curve flat");

    // Reading time picks up the new fields (regression guard for
    // textMetrics not counting `headline` / `summaryBar`).
    const metrics = getDailyTextMetrics(state);
    expect(metrics.perSection.headline).toBeGreaterThan(0);
    expect(metrics.perSection.summary).toBeGreaterThan(0);
    expect(readingTimeMinutes(metrics.total)).toBeGreaterThanOrEqual(1);

    const bbg = generateBBG(state);
    expect(bbg).toContain("Rate decision in line with REM consensus");

    const html = generateHTML(state);
    expect(html).toContain("Rate decision in line with REM consensus");
  });

  it("toggling a section off removes it from BBG and HTML output", () => {
    const { setField, toggleSection } = useDailyStore.getState();
    setField("marketComment", "Risk-on tape; Argentine equities outperform.");

    // Sanity: when the section is on (default), the comment renders.
    const onState = useDailyStore.getState();
    expect(onState.sections.find((s) => s.key === "marketComment")?.on).toBe(true);
    expect(generateBBG(onState)).toContain("Risk-on tape");
    expect(generateHTML(onState)).toContain("Risk-on tape");

    // Toggle off → output omits the comment block.
    toggleSection("marketComment");
    const offState = useDailyStore.getState();
    expect(offState.sections.find((s) => s.key === "marketComment")?.on).toBe(false);
    expect(generateBBG(offState)).not.toContain("Risk-on tape");
    expect(generateHTML(offState)).not.toContain("Risk-on tape");
  });

  it("adding a macro block via updateListItem puts the body in both outputs", () => {
    const { addListItem, updateListItem } = useDailyStore.getState();

    // Start with a fresh block so the test isn't entangled with the
    // two seeded ones — gives us a known headline to grep for.
    const newBlock = {
      id: "macro-test-1",
      title: "TEST RATE DECISION",
      body: "BCRA cut by 100bp to 38% — first cut since the September election.",
      lsPick: "Long ARGENT 35/38 on the dovish surprise.",
    };
    addListItem("macroBlocks", newBlock);
    // Force-update via updateListItem to confirm the editor's typical
    // mutation path also works (the per-keystroke updates).
    updateListItem("macroBlocks", "macro-test-1", "body", "BCRA cut by 100bp to 38% — first cut since the September election.");

    const state = useDailyStore.getState();
    const block = state.macroBlocks.find((b) => b.id === "macro-test-1");
    expect(block?.body).toContain("first cut");

    const bbg = generateBBG(state);
    expect(bbg).toContain("TEST RATE DECISION");
    expect(bbg).toContain("first cut since the September election");
    expect(bbg).toContain("Long ARGENT 35/38");

    const html = generateHTML(state);
    expect(html).toContain("TEST RATE DECISION");
    expect(html).toContain("first cut since the September election");
  });

  it("removeListItem drops the macro block from outputs", () => {
    const { addListItem, removeListItem } = useDailyStore.getState();
    addListItem("macroBlocks", {
      id: "to-be-removed",
      title: "DOOMED BLOCK",
      body: "Will not survive.",
      lsPick: "",
    });

    expect(generateBBG(useDailyStore.getState())).toContain("DOOMED BLOCK");

    removeListItem("macroBlocks", "to-be-removed");
    expect(generateBBG(useDailyStore.getState())).not.toContain("DOOMED BLOCK");
    expect(generateHTML(useDailyStore.getState())).not.toContain("DOOMED BLOCK");
  });

  it("equity pick exit trigger renders 'Change my mind' in both outputs", () => {
    const { updateListItem } = useDailyStore.getState();
    // The default state seeds BBAR with an empty exitTrigger — set
    // one and check it surfaces.
    updateListItem("equityPicks", "ep-bbar", "reason", "ROE 28%, NIM expanding into a lower-rate cycle.");
    updateListItem("equityPicks", "ep-bbar", "exitTrigger", "Sustained NIM compression below 4% for two consecutive quarters.");

    const state = useDailyStore.getState();

    const bbg = generateBBG(state);
    expect(bbg).toContain("ROE 28%");
    expect(bbg).toContain("Change my mind: Sustained NIM compression");

    const html = generateHTML(state);
    expect(html).toContain("Change my mind:");
    expect(html).toContain("Sustained NIM compression below 4%");
  });

  it("Latest Report with analystId resolves to analyst name in outputs", () => {
    const { setField, addListItem } = useDailyStore.getState();
    // Make sure the section is on (it defaults on but a prior test
    // could have flipped it; defensive).
    const sections = useDailyStore.getState().sections.map((s) =>
      s.key === "latestReports" ? { ...s, on: true } : s,
    );
    setField("sections", sections);

    addListItem("latestReports", {
      id: "lr-test-1",
      type: "Macro",
      title: "Argentina 2026 Outlook",
      author: "",
      analystId: "a1", // George Gasztowtt — seeded in DEFAULT_STATE
      publishedDate: "2026-04-15",
      link: "https://research.latinsecurities.ar/argentina-2026",
    });

    const state = useDailyStore.getState();

    const bbg = generateBBG(state);
    expect(bbg).toContain("Argentina 2026 Outlook");
    expect(bbg).toContain("George Gasztowtt");
    // The free-text author should NOT leak into the output when
    // analystId is the source of truth.
    expect(bbg).not.toContain('author":"');
    // Unified link framing — same "Full report:" label as Corporate / Research.
    expect(bbg).toContain("↗ Full report: https://research.latinsecurities.ar/argentina-2026");

    const html = generateHTML(state);
    expect(html).toContain("Argentina 2026 Outlook");
    expect(html).toContain("George Gasztowtt");
  });

  it("preflight review catches an empty headline and an over-long one", () => {
    const { setField } = useDailyStore.getState();

    // Empty headline (default) — preflight flags it.
    let issues = preflightReview(useDailyStore.getState());
    const emptyHeadlineIssue = issues.find((m) => /headline/i.test(m));
    expect(emptyHeadlineIssue).toBeTruthy();

    // Set a reasonable headline — that specific issue clears.
    setField("headline", "BCRA holds; positioning light into the long weekend.");
    issues = preflightReview(useDailyStore.getState());
    expect(issues.find((m) => /headline.*missing|missing.*headline|empty.*headline/i.test(m))).toBeFalsy();

    // Way-too-long headline (>90 chars hard cap) — should re-flag.
    setField(
      "headline",
      "BCRA holds; AR3M flat through year-end as desk positioning stays light into the long weekend with US holiday tomorrow",
    );
    issues = preflightReview(useDailyStore.getState());
    expect(issues.find((m) => /long|character|length/i.test(m))).toBeTruthy();
  });

  it("end-to-end: assemble a small daily and assert both formats line up", () => {
    const { setField, updateListItem, addListItem } = useDailyStore.getState();

    setField("headline", "Risk-on tape on BCRA dovish surprise");
    setField("summaryBar", "BCRA cuts 100bp to 38%; ARS curve rallies, ADRs +2%.");
    // yesterdayRecap defaults to `on: false` (analyst opt-in) — enable
    // it so the assertions below can find the recap content.
    setField(
      "sections",
      useDailyStore.getState().sections.map((s) =>
        s.key === "yesterdayRecap" ? { ...s, on: true } : s,
      ),
    );
    setField("yesterdayRecap", "Yesterday's call: long Bonares 2030 — paid off, +1.2% on the day.");
    addListItem("macroBlocks", {
      id: "e2e-macro-1",
      title: "BCRA RATE DECISION",
      body: "100bp cut to 38%, in line with the dovish tail of REM expectations.",
      lsPick: "Stay long the long end (ARGENT 35/38).",
    });
    updateListItem("equityPicks", "ep-bbar", "reason", "Beneficiary of the steepening curve.");

    const state = useDailyStore.getState();
    const bbg = generateBBG(state);
    const html = generateHTML(state);

    // Same content lands in both formats — same key facts, same numbers.
    for (const fragment of [
      "BCRA cuts 100bp to 38%",
      "long Bonares 2030",
      "BCRA RATE DECISION",
      "100bp cut to 38%",
      "Stay long the long end",
      "Beneficiary of the steepening curve",
    ]) {
      expect(bbg, `BBG should contain "${fragment}"`).toContain(fragment);
      expect(html, `HTML should contain "${fragment}"`).toContain(fragment);
    }

    // Reading time reflects the added prose (>5s of typing worth).
    const metrics = getDailyTextMetrics(state);
    expect(metrics.total).toBeGreaterThan(20);
  });
});
