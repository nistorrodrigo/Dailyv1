import { describe, it, expect } from "vitest";
import { reconcileDecision } from "../lib/supabaseSync";

/**
 * Coverage for the cross-device sync reconciliation rule.
 *
 * `reconcileDecision` is the pure brain of supabaseSync — given the
 * trigger + server/local timestamps + edit state, it decides whether
 * to apply the server daily, raise a conflict, or do nothing. The
 * cross-device bug (phone and laptop showing different state) was a
 * consequence of the OLD code having no such rule; these tests pin
 * every branch so it can't silently regress.
 */

describe("reconcileDecision — mount", () => {
  it("always applies on mount (fresh page load, load the latest)", () => {
    // A fresh load has no in-session context to protect — pulling
    // the most-recent server daily IS the point of the fix.
    expect(
      reconcileDecision({
        trigger: "mount",
        serverUpdatedAt: "2026-05-21T10:00:00Z",
        serverDate: "2026-05-21",
        lastLoadedUpdatedAt: null,
        currentDate: "2026-05-18",
        hasUserEdited: false,
      }),
    ).toBe("apply");
  });

  it("applies on mount even when local has a different (stale) date", () => {
    // This is the core bug scenario: the phone's localStorage holds
    // an old date; mount must still load the latest server daily.
    expect(
      reconcileDecision({
        trigger: "mount",
        serverUpdatedAt: "2026-05-21T10:00:00Z",
        serverDate: "2026-05-21",
        lastLoadedUpdatedAt: null,
        currentDate: "2026-05-15",
        hasUserEdited: false,
      }),
    ).toBe("apply");
  });
});

describe("reconcileDecision — focus refetch", () => {
  it("noop when the server is not newer than our last load", () => {
    expect(
      reconcileDecision({
        trigger: "focus",
        serverUpdatedAt: "2026-05-21T10:00:00Z",
        serverDate: "2026-05-21",
        lastLoadedUpdatedAt: "2026-05-21T10:00:00Z",
        currentDate: "2026-05-21",
        hasUserEdited: false,
      }),
    ).toBe("noop");
  });

  it("noop when the server daily is a different date (deliberate History view)", () => {
    // The analyst opened an older daily via the History panel. A
    // tab-switch shouldn't yank them back to today's daily.
    expect(
      reconcileDecision({
        trigger: "focus",
        serverUpdatedAt: "2026-05-21T12:00:00Z",
        serverDate: "2026-05-21",
        lastLoadedUpdatedAt: "2026-05-18T09:00:00Z",
        currentDate: "2026-05-15",
        hasUserEdited: false,
      }),
    ).toBe("noop");
  });

  it("applies when same date, server newer, and no local edits", () => {
    // Edited on the laptop, picked up the phone — no edits in
    // progress on the phone, so the server copy applies cleanly.
    expect(
      reconcileDecision({
        trigger: "focus",
        serverUpdatedAt: "2026-05-21T12:00:00Z",
        serverDate: "2026-05-21",
        lastLoadedUpdatedAt: "2026-05-21T10:00:00Z",
        currentDate: "2026-05-21",
        hasUserEdited: false,
      }),
    ).toBe("apply");
  });

  it("raises a conflict when same date, server newer, AND local edits exist", () => {
    // The analyst is mid-edit on this device while another device
    // pushed a newer version. Never overwrite silently.
    expect(
      reconcileDecision({
        trigger: "focus",
        serverUpdatedAt: "2026-05-21T12:00:00Z",
        serverDate: "2026-05-21",
        lastLoadedUpdatedAt: "2026-05-21T10:00:00Z",
        currentDate: "2026-05-21",
        hasUserEdited: true,
      }),
    ).toBe("conflict");
  });

  it("applies on first focus refetch when there is no prior watermark", () => {
    // lastLoadedUpdatedAt null → the not-newer guard is skipped;
    // same date + no edits → apply.
    expect(
      reconcileDecision({
        trigger: "focus",
        serverUpdatedAt: "2026-05-21T12:00:00Z",
        serverDate: "2026-05-21",
        lastLoadedUpdatedAt: null,
        currentDate: "2026-05-21",
        hasUserEdited: false,
      }),
    ).toBe("apply");
  });
});

describe("reconcileDecision — edge ordering", () => {
  it("the not-newer guard wins over the conflict branch", () => {
    // Even with local edits, if the server isn't newer there's
    // nothing to reconcile — noop, no spurious conflict modal.
    expect(
      reconcileDecision({
        trigger: "focus",
        serverUpdatedAt: "2026-05-21T09:00:00Z",
        serverDate: "2026-05-21",
        lastLoadedUpdatedAt: "2026-05-21T10:00:00Z",
        currentDate: "2026-05-21",
        hasUserEdited: true,
      }),
    ).toBe("noop");
  });

  it("the different-date guard wins over the conflict branch", () => {
    // Viewing an old daily with local edits — a focus event must
    // not raise a conflict about today's server daily.
    expect(
      reconcileDecision({
        trigger: "focus",
        serverUpdatedAt: "2026-05-21T12:00:00Z",
        serverDate: "2026-05-21",
        lastLoadedUpdatedAt: "2026-05-10T10:00:00Z",
        currentDate: "2026-05-10",
        hasUserEdited: true,
      }),
    ).toBe("noop");
  });
});
