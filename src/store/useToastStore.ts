import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  /** Auto-dismiss after this many ms. 0 = never. Default: 4000 (3s for success, 6s for error). */
  durationMs: number;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (kind: ToastKind, message: string, durationMs?: number) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;

const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  push: (kind, message, durationMs) => {
    const id = nextId++;
    const dur = durationMs ?? (kind === "error" ? 6000 : 3500);
    set((s) => ({ toasts: [...s.toasts, { id, kind, message, durationMs: dur }] }));
    if (dur > 0) {
      setTimeout(() => get().dismiss(id), dur);
    }
    return id;
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Convenience helpers — call from anywhere without needing the hook.
 *   import { toast } from "../store/useToastStore";
 *   toast.success("Copied to clipboard");
 *   toast.error("Failed to load: " + err.message);
 */
export const toast = {
  success: (message: string, durationMs?: number) => useToastStore.getState().push("success", message, durationMs),
  error: (message: string, durationMs?: number) => useToastStore.getState().push("error", message, durationMs),
  info: (message: string, durationMs?: number) => useToastStore.getState().push("info", message, durationMs),
};

export default useToastStore;
