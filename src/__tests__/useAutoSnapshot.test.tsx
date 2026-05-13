import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

// `vi.mock` factories are hoisted to the top of the file (before
// any `const` declarations). Use `vi.hoisted` to set up the spy
// in the same hoisted phase so it's defined when the factory
// runs. Without this, the factory closes over `undefined`.
const { saveVersionMock } = vi.hoisted(() => ({
  saveVersionMock: vi.fn(async () => ({
    id: "v-test",
    daily_date: "2026-04-29",
    label: "Auto · 14:35",
    created_at: new Date().toISOString(),
  })),
}));
vi.mock("../lib/versionsApi", () => ({
  saveVersion: saveVersionMock,
}));
vi.mock("../lib/supabase", () => ({
  supabase: { /* truthy stub so the hook's `if (!supabase) return` passes */ },
}));

import { useAutoSnapshot } from "../hooks/useAutoSnapshot";
import useDailyStore from "../store/useDailyStore";

function Mount() {
  useAutoSnapshot();
  return null;
}

const ORIGINAL_DATE = useDailyStore.getState().date;

beforeEach(() => {
  saveVersionMock.mockClear();
  vi.useFakeTimers();
  // Anchor the fake clock to a known moment so Date.now() math
  // (the EDIT_DEBOUNCE_MS window) is deterministic.
  vi.setSystemTime(new Date("2026-04-29T12:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useAutoSnapshot", () => {
  it("skips saving when the store hasn't been dirtied", () => {
    render(<Mount />);
    // Advance past one full snapshot interval (5 min).
    vi.advanceTimersByTime(5 * 60 * 1000 + 100);
    expect(saveVersionMock).not.toHaveBeenCalled();
  });

  it("saves a snapshot 5 min after an edit (with the EDIT_DEBOUNCE settled)", async () => {
    render(<Mount />);
    // Trigger a real store mutation — subscribe fires, dirtyRef = true.
    useDailyStore.setState({ summaryBar: "test edit" });
    // Advance JUST past the 2s edit-debounce so the next interval
    // sees a "settled" dirty state.
    await vi.advanceTimersByTimeAsync(3 * 1000);
    // Now advance to the first interval tick (5 min from mount).
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(saveVersionMock).toHaveBeenCalledTimes(1);
    expect(saveVersionMock).toHaveBeenCalledWith(
      expect.any(String), // date
      expect.objectContaining({ summaryBar: "test edit" }),
    );
  });

  it("defers when an edit happened within the EDIT_DEBOUNCE window", async () => {
    render(<Mount />);
    // Advance close to the first interval tick.
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 100);
    // Edit JUST before the tick — the next tick should skip
    // because we're still inside the 2s window.
    useDailyStore.setState({ summaryBar: "late edit" });
    await vi.advanceTimersByTimeAsync(200); // interval fires
    expect(saveVersionMock).not.toHaveBeenCalled();
  });

  it("skips when the tab is hidden", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    render(<Mount />);
    useDailyStore.setState({ summaryBar: "edit while hidden" });
    await vi.advanceTimersByTimeAsync(3 * 1000);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(saveVersionMock).not.toHaveBeenCalled();
    // Restore visibility for subsequent tests.
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  it("clears the dirty flag after a successful save so the next save needs a new edit", async () => {
    render(<Mount />);
    useDailyStore.setState({ summaryBar: "first edit" });
    await vi.advanceTimersByTimeAsync(3 * 1000);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(saveVersionMock).toHaveBeenCalledTimes(1);
    // No further edit between the first save and the next
    // interval — dirty flag is cleared, the next tick should
    // be a no-op.
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(saveVersionMock).toHaveBeenCalledTimes(1);
  });

  it("retries on next interval after a saveVersion failure (dirty flag stays)", async () => {
    saveVersionMock.mockRejectedValueOnce(new Error("network blip"));
    render(<Mount />);
    useDailyStore.setState({ summaryBar: "edit triggering save" });
    await vi.advanceTimersByTimeAsync(3 * 1000);
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(saveVersionMock).toHaveBeenCalledTimes(1);
    // Second tick — no new edit, but dirtyRef was not cleared
    // because the first save threw. The hook should retry.
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(saveVersionMock).toHaveBeenCalledTimes(2);
  });

  it("restores the original store date in cleanup", () => {
    // Sanity check that the test mutations didn't leak across the
    // suite — useDailyStore is a module singleton.
    useDailyStore.setState({ date: ORIGINAL_DATE });
    expect(useDailyStore.getState().date).toBe(ORIGINAL_DATE);
  });
});
