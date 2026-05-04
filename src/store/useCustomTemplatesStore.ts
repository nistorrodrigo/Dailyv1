import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MacroBlockTemplate } from "../constants/macroBlockTemplates";

/**
 * Per-analyst custom macro-block templates. Lives in localStorage so
 * each analyst curates their own — without a Supabase round-trip
 * and without team-wide sync (which would need a real "team
 * library" UX). When the desk grows or wants shared templates,
 * migrate this to a `macro_templates` Supabase table; the store
 * shape stays the same.
 *
 * Custom templates are surfaced in the macro picker alongside the
 * 10 built-ins, with a star prefix to distinguish them. The
 * analyst can save a finished macro block as a new template and
 * delete templates they no longer use.
 */
interface CustomTemplatesState {
  templates: MacroBlockTemplate[];
  add: (t: Omit<MacroBlockTemplate, "id">) => MacroBlockTemplate;
  remove: (id: string) => void;
  rename: (id: string, label: string, description: string) => void;
}

const STORAGE_KEY = "ls-custom-macro-templates-v1";

const useCustomTemplatesStore = create<CustomTemplatesState>()(
  persist(
    (set) => ({
      templates: [],
      add: (t) => {
        const created: MacroBlockTemplate = {
          ...t,
          // Custom templates are prefixed `custom-` so the picker
          // can tell them apart from built-ins (whose ids are
          // hardcoded strings like `bcra-rate`, `treasury-auction`).
          id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        };
        set((s) => ({ templates: [...s.templates, created] }));
        return created;
      },
      remove: (id) => {
        set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
      },
      rename: (id, label, description) => {
        set((s) => ({
          templates: s.templates.map((t) =>
            t.id === id ? { ...t, label, description } : t,
          ),
        }));
      },
    }),
    { name: STORAGE_KEY, version: 1 },
  ),
);

export default useCustomTemplatesStore;
