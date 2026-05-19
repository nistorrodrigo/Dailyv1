import { describe, it, expect, beforeEach } from "vitest";
import { DEFAULT_STATE } from "../constants/defaultState";
import type { DailyState } from "../types";
import {
  loadPinnedSignatures,
  savePinnedSignatures,
} from "../lib/libraryApi";

/**
 * Coverage for the pure data-shape + pin-set helpers in libraryApi.
 * The Supabase-fetching path (`buildLibrary`) is exercised end-to-end
 * via the LibraryTab integration tests; here we pin the leaf behaviour:
 *
 *   - Pin set round-trips through localStorage as a JSON array
 *   - Corrupt JSON in storage falls back to empty set (no crash)
 *   - Save is idempotent across reloads
 *
 * The flatten functions are not directly exported because callers
 * always go through `buildLibrary`. Their behaviour is captured by
 * the LibraryTab spec which seeds a Supabase mock with known rows
 * and asserts the rendered list — closer to how the feature is used.
 */

beforeEach(() => {
  if (typeof localStorage !== "undefined") localStorage.removeItem("ls-library-pins");
});

describe("loadPinnedSignatures / savePinnedSignatures", () => {
  it("returns an empty set when nothing is in localStorage", () => {
    expect(loadPinnedSignatures().size).toBe(0);
  });

  it("round-trips a set through save → load", () => {
    const pins = new Set<string>(["sig-a", "sig-b", "sig-c"]);
    savePinnedSignatures(pins);
    const loaded = loadPinnedSignatures();
    expect(loaded.has("sig-a")).toBe(true);
    expect(loaded.has("sig-b")).toBe(true);
    expect(loaded.has("sig-c")).toBe(true);
    expect(loaded.size).toBe(3);
  });

  it("returns an empty set when the stored JSON is corrupt", () => {
    // Edge case: storage was tampered with or got truncated. Returning
    // an empty set is safer than throwing on every render of the tab.
    localStorage.setItem("ls-library-pins", "not json {{{");
    expect(loadPinnedSignatures().size).toBe(0);
  });

  it("returns an empty set when the stored value is not an array", () => {
    // Defensive: older code might have stored a different shape.
    localStorage.setItem("ls-library-pins", JSON.stringify({ foo: "bar" }));
    expect(loadPinnedSignatures().size).toBe(0);
  });

  it("filters non-string entries on load", () => {
    // Defensive against future serialiser bugs — only string
    // signatures should make it into the resulting Set.
    localStorage.setItem(
      "ls-library-pins",
      JSON.stringify(["sig-a", 42, null, "sig-b", { foo: 1 }]),
    );
    const loaded = loadPinnedSignatures();
    expect(loaded.size).toBe(2);
    expect(loaded.has("sig-a")).toBe(true);
    expect(loaded.has("sig-b")).toBe(true);
  });

  it("save overwrites previous state, not append", () => {
    savePinnedSignatures(new Set(["sig-a", "sig-b"]));
    savePinnedSignatures(new Set(["sig-c"]));
    const loaded = loadPinnedSignatures();
    expect(loaded.size).toBe(1);
    expect(loaded.has("sig-c")).toBe(true);
    expect(loaded.has("sig-a")).toBe(false);
  });
});

// The `DailyState` import is here so a future TS-strict change that
// drops `latestReports` or `corpBlocks` from the type surfaces in
// this file's compile pass (the field-reach in libraryApi is the
// runtime contract being pinned).
describe("LibraryItem shape (compile-time guard)", () => {
  it("DailyState carries researchReports / latestReports / corpBlocks", () => {
    const s: DailyState = { ...DEFAULT_STATE };
    expect(Array.isArray(s.researchReports)).toBe(true);
    expect(Array.isArray(s.latestReports)).toBe(true);
    expect(Array.isArray(s.corpBlocks)).toBe(true);
  });
});
