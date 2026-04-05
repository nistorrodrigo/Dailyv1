import { saveDaily, loadDaily } from "./dailyApi";
import { supabase } from "./supabase";

let debounceTimer = null;

export function setupSupabaseSync(store) {
  if (!supabase) return;

  // Load from Supabase on init
  const date = store.getState().date;
  if (date) {
    loadDaily(date).then((daily) => {
      if (daily?.state) {
        store.setState({ ...daily.state, saveStatus: "saved" });
      }
    }).catch(() => {});
  }

  // Subscribe to state changes and debounce save
  store.subscribe((state, prevState) => {
    // Skip UI-only changes
    if (
      state.tab !== prevState.tab ||
      state.previewMode !== prevState.previewMode ||
      state.copiedLabel !== prevState.copiedLabel ||
      state.saveStatus !== prevState.saveStatus
    ) {
      return;
    }

    store.setState({ saveStatus: "saving" });

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        const { tab, previewMode, copiedLabel, saveStatus, ...stateToSave } = store.getState();
        await saveDaily(stateToSave.date, stateToSave);
        store.setState({ saveStatus: "saved" });
        setTimeout(() => {
          if (store.getState().saveStatus === "saved") {
            store.setState({ saveStatus: "idle" });
          }
        }, 1500);
      } catch (err) {
        console.error("Supabase save failed:", err);
        store.setState({ saveStatus: "error" });
      }
    }, 2000);
  });
}
