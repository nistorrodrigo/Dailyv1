import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import React, { useRef } from "react";
import { usePanelFocus } from "../hooks/usePanelFocus";

/**
 * Coverage for the focus-on-open / restore-on-close behaviour that
 * the 7 slide-in panels share. Pins the contract so a future
 * refactor that drops the cleanup or moves the focus call doesn't
 * silently regress keyboard-user UX.
 */

function Panel({ open = true }: { open?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  usePanelFocus(ref, open);
  return (
    <div ref={ref} tabIndex={-1} data-testid="panel">
      <button>Inside</button>
    </div>
  );
}

describe("usePanelFocus", () => {
  it("focuses the panel container on mount when enabled", () => {
    const { getByTestId } = render(<Panel />);
    const panel = getByTestId("panel");
    expect(document.activeElement).toBe(panel);
  });

  it("does NOT move focus when `enabled` is false", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    render(<Panel open={false} />);
    // Trigger still focused — the hook short-circuited.
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });

  it("restores focus to the previously-focused element on unmount", () => {
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { unmount, getByTestId } = render(<Panel />);
    // Focus moved into the panel.
    expect(document.activeElement).toBe(getByTestId("panel"));

    unmount();
    // Focus returned to the trigger.
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });

  it("restores focus when `enabled` flips false (panels that mount-but-hide)", () => {
    // Some panels are conditionally mounted; others stay mounted
    // and gate on an `open` prop. This test covers the second
    // pattern — the cleanup must fire on the prop transition,
    // not just on unmount.
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const { getByTestId, rerender } = render(<Panel open={true} />);
    expect(document.activeElement).toBe(getByTestId("panel"));
    rerender(<Panel open={false} />);
    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });

  it("doesn't throw when the previously-focused element has been removed", () => {
    // Edge case: an analyst opens a panel, the trigger element gets
    // re-rendered/replaced while the panel is open, then closes the
    // panel. The captured `previouslyFocused` ref points at a
    // detached element. The hook's `document.contains` guard should
    // skip the focus() call rather than throw.
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const { unmount } = render(<Panel />);
    // Remove the trigger while the panel is open.
    document.body.removeChild(trigger);
    // Unmount should be safe — no throw.
    expect(() => act(() => unmount())).not.toThrow();
  });
});
