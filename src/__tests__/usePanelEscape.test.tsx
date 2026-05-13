import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { fireEvent } from "@testing-library/dom";
import React from "react";
import { usePanelEscape } from "../hooks/usePanelEscape";

/**
 * Coverage for the Escape-to-close hook the 7 slide-in panels share.
 *
 * The previous behaviour (no Escape handler at all) made the panels a
 * keyboard-user trap — these tests pin the new behaviour so a future
 * refactor that drops the handler fails loudly.
 */

function Mount({ onClose, enabled = true }: { onClose: () => void; enabled?: boolean }) {
  usePanelEscape(onClose, enabled);
  return <div data-testid="mount" />;
}

beforeEach(() => {
  // Each test installs its own onClose spy — no shared state.
});
afterEach(() => {
  // The hook cleans up its own listener on unmount, but RTL's
  // cleanup() also unmounts the tree between tests, so no extra
  // teardown needed.
});

describe("usePanelEscape", () => {
  it("calls onClose when the Escape key is pressed", () => {
    const onClose = vi.fn();
    render(<Mount onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onClose for other keys", () => {
    const onClose = vi.fn();
    render(<Mount onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Enter" });
    fireEvent.keyDown(document, { key: "a" });
    fireEvent.keyDown(document, { key: " " });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does NOT attach the listener when `enabled` is false", () => {
    // Some panels are conditionally mounted; others mount-but-hide
    // via an `open` prop. The disabled mode lets the second type
    // skip the listener cost while still keeping the hook call at
    // the top level of the component (Rules of Hooks).
    const onClose = vi.fn();
    render(<Mount onClose={onClose} enabled={false} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount (no stale handler firing later)", () => {
    const onClose = vi.fn();
    const { unmount } = render(<Mount onClose={onClose} />);
    unmount();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("re-attaches the listener when onClose identity changes", () => {
    // Sanity check the useEffect dep — a parent that swaps the
    // onClose callback (uncommon but possible) shouldn't end up
    // with the old callback still bound.
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Mount onClose={first} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(first).toHaveBeenCalledTimes(1);
    rerender(<Mount onClose={second} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(second).toHaveBeenCalledTimes(1);
    // The first callback didn't fire again — the old listener was
    // cleaned up.
    expect(first).toHaveBeenCalledTimes(1);
  });
});
