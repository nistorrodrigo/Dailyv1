import { saveDaily, loadDaily } from "./dailyApi";
import { supabase } from "./supabase";
import useUIStore from "../store/useUIStore";

let debounceTimer = null;

export function setupSupabaseSync(dataStore) {
  if (!supabase) return;

  const setSaveStatus = (status) => useUIStore.getState().setSaveStatus(status);

  // Load from Supabase on init
  const date = dataStore.getState().date;
  if (date) {
    loadDaily(date).then((daily) => {
      if (daily?.state) {
        dataStore.setState({ ...daily.state });
        setSaveStatus("saved");
      }
    }).catch(() => {});
  }

  // Subscribe to data store changes and debounce save
  dataStore.subscribe(() => {
    setSaveStatus("saving");

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      try {
        const state = dataStore.getState();
        await saveDaily(state.date, state);
        setSaveStatus("saved");
        setTimeout(() => {
          if (useUIStore.getState().saveStatus === "saved") {
            setSaveStatus("idle");
          }
        }, 1500);
      } catch (err) {
        console.error("Supabase save failed:", err);
        setSaveStatus("error");
      }
    }, 2000);
  });
}
