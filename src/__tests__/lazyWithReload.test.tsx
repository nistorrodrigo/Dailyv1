import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The module under test reads `window.location` and `sessionStorage`
// at call time. We mock them per-test so each test starts from a
// clean slate.
const realLocation = window.location;

let reloadSpy: ReturnType<typeof vi.fn>;
let storage: Record<string, string>;

beforeEach(async () => {
  storage = {};
  // Stub sessionStorage via the existing object's getItem/setItem.
  // Can't replace `window.sessionStorage` wholesale in happy-dom
  // (non-configurable) but we can monkey-patch its methods.
  vi.spyOn(window.sessionStorage, "getItem").mockImplementation(
    (k: string) => (k in storage ? storage[k] : null),
  );
  vi.spyOn(window.sessionStorage, "setItem").mockImplementation(
    (k: string, v: string) => {
      storage[k] = v;
    },
  );
  vi.spyOn(window.sessionStorage, "removeItem").mockImplementation((k: string) => {
    delete storage[k];
  });

  reloadSpy = vi.fn();
  // Replace location.reload via Object.defineProperty (configurable
  // in happy-dom). The full location object gets a new reload.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...realLocation, reload: reloadSpy },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, "location", { configurable: true, value: realLocation });
});

describe("isStaleBundleError", () => {
  it("matches the four documented stale-bundle error phrasings", async () => {
    const { isStaleBundleError } = await import("../lib/lazyWithReload");
    for (const msg of [
      "Failed to fetch dynamically imported module: https://x/foo.js",
      "Loading chunk 42 failed",
      "error loading dynamically imported module",
      "Importing a module script failed",
    ]) {
      expect(isStaleBundleError(new Error(msg)), msg).toBe(true);
    }
  });

  it("does NOT match unrelated runtime errors", async () => {
    const { isStaleBundleError } = await import("../lib/lazyWithReload");
    for (const msg of [
      "TypeError: Cannot read properties of undefined",
      "Network request failed",
      "TimeoutError",
      "Permission denied",
    ]) {
      expect(isStaleBundleError(new Error(msg)), msg).toBe(false);
    }
  });

  it("handles non-Error throwables", async () => {
    const { isStaleBundleError } = await import("../lib/lazyWithReload");
    expect(isStaleBundleError("Failed to fetch dynamically imported module")).toBe(true);
    expect(isStaleBundleError(undefined)).toBe(false);
    expect(isStaleBundleError(null)).toBe(false);
    expect(isStaleBundleError(42)).toBe(false);
  });
});

describe("triggerReload (one-shot recovery)", () => {
  it("calls window.location.reload() and sets the dedupe flag", async () => {
    const { triggerReload } = await import("../lib/lazyWithReload");
    const result = triggerReload();
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(storage["ls-chunk-reload-attempted"]).toBe("1");
    // Returns a promise (used by lazyWithReload to keep Suspense
    // from rendering a fallback while the tab reloads).
    expect(result).toBeInstanceOf(Promise);
  });

  it("returns false on second call in same session (gate)", async () => {
    const { triggerReload } = await import("../lib/lazyWithReload");
    storage["ls-chunk-reload-attempted"] = "1"; // pretend a prior reload fired
    const result = triggerReload();
    expect(result).toBe(false);
    expect(reloadSpy).not.toHaveBeenCalled();
  });
});

describe("clearReloadFlag", () => {
  it("removes the sessionStorage flag", async () => {
    const { clearReloadFlag } = await import("../lib/lazyWithReload");
    storage["ls-chunk-reload-attempted"] = "1";
    clearReloadFlag();
    expect(storage["ls-chunk-reload-attempted"]).toBeUndefined();
  });

  it("is a no-op when no flag is set", async () => {
    const { clearReloadFlag } = await import("../lib/lazyWithReload");
    expect(() => clearReloadFlag()).not.toThrow();
  });
});
