import { useEffect, type RefObject } from "react";

/**
 * Manage focus when a slide-in side panel opens / closes.
 *
 * On open (`enabled` flips true): captures whatever element was
 * focused at that moment (typically the toolbar button that opened
 * the panel) and moves focus into the panel container. The container
 * should have `tabIndex={-1}` so it accepts programmatic focus but
 * doesn't enter the tab order. Screen readers announce the dialog
 * via the panel's `aria-labelledby`, and the next Tab moves to the
 * first interactive element inside.
 *
 * On close (`enabled` flips false, or component unmount): restores
 * focus to the previously-captured element. Without this, focus
 * collapses to `<body>` when the panel disappears — a keyboard
 * user loses their place in the toolbar.
 *
 * The panel was previously a focus dead-zone: opening it didn't
 * move focus at all (screen readers had no idea anything happened)
 * and closing it left focus on the now-detached close × button
 * (which then snapped back to body).
 *
 * Pairs with `usePanelEscape` for the keyboard side, and with
 * `role="dialog" aria-modal="true" aria-labelledby={...}` for the
 * announcement side.
 */
export function usePanelFocus(
  panelRef: RefObject<HTMLElement | null>,
  enabled: boolean = true,
): void {
  useEffect(() => {
    if (!enabled) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => {
      // The previously-focused element might have unmounted while
      // the panel was open (rare, but e.g. the analyst navigated
      // tabs). Defensive checks before calling focus().
      if (
        previouslyFocused &&
        typeof previouslyFocused.focus === "function" &&
        document.contains(previouslyFocused)
      ) {
        previouslyFocused.focus();
      }
    };
    // panelRef is a stable ref object — its identity doesn't change
    // across renders, so we deliberately exclude it from the deps
    // array. Only `enabled` should re-trigger the effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
