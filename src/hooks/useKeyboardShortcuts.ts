import { useEffect } from "react";
import useDailyStore from "../store/useDailyStore";
import useUIStore from "../store/useUIStore";
import { generateHTML } from "../utils/generateHTML";
import { generateBBG } from "../utils/generateBBG";

export default function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e) => {
      const isCtrl = e.ctrlKey || e.metaKey;
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
          // Only if not focused on an input
          if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
          e.preventDefault();
          const state = useDailyStore.getState();
          const bbg = generateBBG(state);
          useUIStore.getState().copyToClipboard(bbg, "bbg");
          break;
        }
        case "n": {
          if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
          e.preventDefault();
          useDailyStore.getState().newDaily();
          break;
        }
        case "p": {
          if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
          e.preventDefault();
          const ui = useUIStore.getState();
          ui.setTab(ui.tab === "preview" ? "edit" : "preview");
          break;
        }
        case "z": {
          if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
          e.preventDefault();
          if (e.shiftKey) {
            useDailyStore.temporal.getState().redo();
          } else {
            useDailyStore.temporal.getState().undo();
          }
          break;
        }
        case "d": {
          if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
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
