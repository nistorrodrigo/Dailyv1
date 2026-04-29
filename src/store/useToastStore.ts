import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  /** Auto-dismiss after this many ms. 0 = never. Default: 4000 (3s for success, 6s for error). */
  durationMs: number;
  /** Optional inline action button — e.g. "Add as link" / "Undo". */
  action?: ToastAction;
}

export interface ToastOptions {
  durationMs?: number;
  action?: ToastAction;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (kind: ToastKind, message: string, options?: ToastOptions) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;

const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],

  push: (kind, message, options = {}) => {
    const id = nextId++;
    const dur = options.durationMs ?? (kind === "error" ? 6000 : 3500);
    set((s) => ({ toasts: [...s.toasts, { id, kind, message, durationMs: dur, action: options.action }] }));
    if (dur > 0) {
      setTimeout(() => get().dismiss(id), dur);
    }
    return id;
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/**
 * Convenience helpers — call from anywhere without needing the hook.
 *   toast.success("Copied to clipboard");
 *   toast.error("Failed to load: " + err.message);
 *   toast.info("Pasted a URL", { action: { label: "Add as link", onClick: () => ... } });
 *
 * Backwards compatible: a plain number `durationMs` second arg still works.
 */
function normalize(arg?: number | ToastOptions): ToastOptions {
  if (arg === undefined) return {};
  if (typeof arg === "number") return { durationMs: arg };
  return arg;
}

export const toast = {
  success: (message: string, opts?: number | ToastOptions) => useToastStore.getState().push("success", message, normalize(opts)),
  error: (message: string, opts?: number | ToastOptions) => useToastStore.getState().push("error", message, normalize(opts)),
  info: (message: string, opts?: number | ToastOptions) => useToastStore.getState().push("info", message, normalize(opts)),
};

export default useToastStore;
