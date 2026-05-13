import { create } from "zustand";
import type { UIState } from "../types";

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
    // .catch covers insecure-context / permissions-denied / no-user-
    // gesture scenarios where clipboard writes throw. Without it
    // the rejection bubbles to window.onunhandledrejection and
    // Sentry captures `NotAllowedError: Write permission denied`
    // for every Safari-in-iframe or screen-share session.
    navigator.clipboard
      .writeText(text)
      .then(() => {
        set({ copiedLabel: label });
        setTimeout(() => set({ copiedLabel: "" }), 2000);
      })
      .catch(() => {
        // Silently swallow — UI doesn't flip to "✓ Copied" so the
        // analyst sees the failure as "nothing happened" and can
        // try Ctrl-C manually.
      });
  },

  toggleShortcutsOverlay: () => set((s) => ({ shortcutsOverlayOpen: !s.shortcutsOverlayOpen })),
  setShortcutsOverlayOpen: (open: boolean) => set({ shortcutsOverlayOpen: open }),
}));

export default useUIStore;
