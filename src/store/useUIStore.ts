import { create } from "zustand";
import type { UIState } from "../types";
import { copyText } from "../utils/clipboard";

interface UIActions {
  setTab: (tab: UIState["tab"]) => void;
  setPreviewMode: (mode: UIState["previewMode"]) => void;
  setSaveStatus: (status: UIState["saveStatus"]) => void;
  setCopiedLabel: (label: string) => void;
  toggleDarkMode: () => void;
  copyToClipboard: (text: string, label: string) => void;
  toggleShortcutsOverlay: () => void;
  setShortcutsOverlayOpen: (open: boolean) => void;
}

interface UIStore extends UIState {
  lastSavedAt: number | null;
  shortcutsOverlayOpen: boolean;
}

const useUIStore = create<UIStore & UIActions>((set, get) => ({
  tab: "edit",
  previewMode: "html",
  copiedLabel: "",
  saveStatus: "idle",
  lastSavedAt: null,
  darkMode: localStorage.getItem("ls-dark-mode") === "1",
  shortcutsOverlayOpen: false,

  setTab: (tab: UIState["tab"]) => set({ tab }),
  setPreviewMode: (mode: UIState["previewMode"]) => set({ previewMode: mode }),
  setSaveStatus: (status: UIState["saveStatus"]) => set({
    saveStatus: status,
    ...(status === "saved" ? { lastSavedAt: Date.now() } : {}),
  }),

  setCopiedLabel: (label: string) => {
    set({ copiedLabel: label });
    setTimeout(() => set({ copiedLabel: "" }), 2000);
  },

  toggleDarkMode: () => {
    const next = !get().darkMode;
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("ls-dark-mode", next ? "1" : "0");
    set({ darkMode: next });
  },

  copyToClipboard: (text: string, label: string) => {
    // `copyText` returns false on failure → `copiedLabel` stays empty
    // and the analyst sees the click did nothing, prompting Ctrl-C.
    // `errorMessage: null` suppresses the default toast — this action
    // is the keyboard-shortcut path where the UI affordance (the
    // "✓ Copied" label flip) IS the success signal; we don't want a
    // duplicate toast on every Ctrl-Shift-C.
    copyText(text, { errorMessage: null }).then((ok) => {
      if (!ok) return;
      set({ copiedLabel: label });
      setTimeout(() => set({ copiedLabel: "" }), 2000);
    });
  },

  toggleShortcutsOverlay: () => set((s) => ({ shortcutsOverlayOpen: !s.shortcutsOverlayOpen })),
  setShortcutsOverlayOpen: (open: boolean) => set({ shortcutsOverlayOpen: open }),
}));

export default useUIStore;
