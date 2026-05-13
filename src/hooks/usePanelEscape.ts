import { useEffect } from "react";

/**
 * Close-on-Escape handler for slide-in side panels.
 *
 * Every panel (AIReview, Contacts, Diff, Schedule, Workflow, History,
 * Templates) used to require the analyst to either click the × button
 * or click outside — Escape did nothing. For a keyboard-only user
 * (or anyone with the trackpad disabled), the panel was effectively
 * a trap.
 *
 * Listens globally rather than scoped to a panel ref because the
 * Escape keystroke shouldn't depend on focus being inside the
 * panel — that focus management is a separate concern (currently
 * unhandled; a future commit could add a focus trap).
 *
 * `enabled` lets the caller skip the listener entirely when the
 * panel is hidden, so we don't pay the addEventListener cost for
 * every panel that's not visible.
 */
export function usePanelEscape(onClose: () => void, enabled: boolean = true): void {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, enabled]);
}
