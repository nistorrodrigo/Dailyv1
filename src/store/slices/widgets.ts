import type { ChartImage } from "../../types";
import type { DailySliceCreator } from "./_helpers";

/**
 * Widgets slice — accessors for the optional widgets that appear above
 * the main content (chart of the day, BCRA dashboard). Stays small
 * intentionally: each widget owns at most a handful of fields and the
 * actions are thin wrappers around `set`. If a widget grows non-trivial
 * logic (a fetch loop, validation, format conversion), it should
 * either get its own slice or move to a dedicated lib/ helper, not
 * accumulate here.
 */

export interface WidgetsSlice {
  setChartImage: (img: ChartImage | null) => void;
  setBcraData: (data: Record<string, string> | null) => void;
  toggleBcraRow: (key: string) => void;
}

export const createWidgetsSlice: DailySliceCreator<WidgetsSlice> = (set) => ({
  setChartImage: (img) => set({ chartImage: img }),

  setBcraData: (data) => set({ bcraData: data }),

  toggleBcraRow: (key) =>
    set((s) => ({
      bcraHiddenRows: { ...s.bcraHiddenRows, [key]: !s.bcraHiddenRows[key] },
    })),
});
