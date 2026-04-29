import { useEffect } from "react";
import useDailyStore from "../store/useDailyStore";
import useUIStore from "../store/useUIStore";
import { generateHTML } from "../utils/generateHTML";
import { generateBBG } from "../utils/generateBBG";
import { toast } from "../store/useToastStore";

/**
 * Single source of truth for the app's keyboard shortcuts.
 *
 * Naming convention:
 *  - Global shortcuts (Ctrl/Cmd + key) work anywhere; they call
 *    `e.preventDefault()` to override browser defaults.
 *  - Plain-key shortcuts only fire when no input/textarea is focused, so
 *    typing in a field doesn't trigger them.
 */
export const SHORTCUTS: { combo: string; description: string }[] = [
  { combo: "Ctrl/⌘ + S", description: "Copy email HTML to clipboard" },
  { combo: "Ctrl/⌘ + B", description: "Copy Bloomberg-formatted text" },
  { combo: "Ctrl/⌘ + Z", description: "Undo last change" },
  { combo: "Ctrl/⌘ + Shift + Z", description: "Redo" },
  { combo: "Ctrl/⌘ + Y", description: "Redo (Windows-style)" },
  { combo: "Ctrl/⌘ + N", description: "Start a new daily" },
  { combo: "Ctrl/⌘ + E", description: "Switch to Editor tab" },
  { combo: "Ctrl/⌘ + P", description: "Switch to Preview tab" },
  { combo: "Ctrl/⌘ + D", description: "Toggle dark mode" },
  { combo: "?", description: "Show this shortcuts overlay" },
  { combo: "Esc", description: "Close shortcuts overlay" },
];

const isTypingTarget = (el: EventTarget | null): boolean => {
  if (!el) return false;
  const tag = (el as HTMLElement).tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
};

export default function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const isCtrl: boolean = e.ctrlKey || e.metaKey;
      const target = e.target;

      // ── ? toggles the shortcuts overlay (works anywhere, including inputs
      //    where the user has to hold Shift to type ?, so it's unambiguous) ──
      if (e.key === "?" && !isCtrl) {
        e.preventDefault();
        useUIStore.getState().toggleShortcutsOverlay();
        return;
      }

      // ── Esc closes the overlay (only) ──
      if (e.key === "Escape" && useUIStore.getState().shortcutsOverlayOpen) {
        e.preventDefault();
        useUIStore.getState().setShortcutsOverlayOpen(false);
        return;
      }

      if (!isCtrl) return;

      switch (e.key.toLowerCase()) {
        case "s": {
          e.preventDefault();
          const state = useDailyStore.getState();
          const html = generateHTML(state);
          useUIStore.getState().copyToClipboard(html, "html");
          break;
        }
        case "b": {
          if (isTypingTarget(target)) return;
          e.preventDefault();
          const state = useDailyStore.getState();
          const bbg = generateBBG(state);
          useUIStore.getState().copyToClipboard(bbg, "bbg");
          break;
        }
        case "n": {
          if (isTypingTarget(target)) return;
          e.preventDefault();
          useDailyStore.getState().newDaily();
          break;
        }
        case "e": {
          if (isTypingTarget(target)) return;
          e.preventDefault();
          useUIStore.getState().setTab("edit");
          break;
        }
        case "p": {
          if (isTypingTarget(target)) return;
          e.preventDefault();
          const ui = useUIStore.getState();
          ui.setTab(ui.tab === "preview" ? "edit" : "preview");
          break;
        }
        case "z": {
          if (isTypingTarget(target)) return; // let inputs handle their own undo
          e.preventDefault();
          if (e.shiftKey) {
            useDailyStore.temporal.getState().redo();
            toast.info("Redone", 1500);
          } else {
            useDailyStore.temporal.getState().undo();
            toast.info("Undone", 1500);
          }
          break;
        }
        case "y": {
          // Windows-style redo. Inputs already use Ctrl+Y for nothing useful,
          // so it's safe to intercept here too.
          if (isTypingTarget(target)) return;
          e.preventDefault();
          useDailyStore.temporal.getState().redo();
          toast.info("Redone", 1500);
          break;
        }
        case "d": {
          if (isTypingTarget(target)) return;
          e.preventDefault();
          useUIStore.getState().toggleDarkMode();
          break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
