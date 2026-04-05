import { create } from "zustand";

const useUIStore = create((set, get) => ({
  tab: "edit",
  previewMode: "html",
  copiedLabel: "",
  saveStatus: "idle",
  darkMode: localStorage.getItem("ls-dark-mode") === "1",

  setTab: (tab) => set({ tab }),
  setPreviewMode: (mode) => set({ previewMode: mode }),
  setSaveStatus: (status) => set({ saveStatus: status }),

  setCopiedLabel: (label) => {
    set({ copiedLabel: label });
    setTimeout(() => set({ copiedLabel: "" }), 2000);
  },

  toggleDarkMode: () => {
    const next = !get().darkMode;
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("ls-dark-mode", next ? "1" : "0");
    set({ darkMode: next });
  },

  copyToClipboard: (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      set({ copiedLabel: label });
      setTimeout(() => set({ copiedLabel: "" }), 2000);
    });
  },
}));

export default useUIStore;
