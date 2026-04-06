import useDailyStore from "../store/useDailyStore";
import { loadDaily } from "../lib/dailyApi";
import { supabase } from "../lib/supabase";
import { DEFAULT_STATE } from "../constants/defaultState";

export default function DuplicateYesterdayBtn() {
  const handleDuplicate = async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yDate = yesterday.toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];

    if (!supabase) {
      // Without Supabase, just reset with today's date keeping analysts/signatures
      const prev = useDailyStore.getState();
      if (window.confirm("No history available (Supabase not configured). Start a fresh daily for today?")) {
        useDailyStore.setState({
          ...DEFAULT_STATE,
          analysts: prev.analysts,
          signatures: prev.signatures,
          date: today,
        });
      }
      return;
    }

    try {
      const daily = await loadDaily(yDate);
      if (!daily?.state) {
        alert(`No daily found for ${yDate}. Try loading from History instead.`);
        return;
      }
      if (!window.confirm(`Load yesterday's daily (${yDate}) as today's template? Content will be copied, date set to ${today}.`)) return;

      const prev = useDailyStore.getState();
      useDailyStore.setState({
        ...daily.state,
        date: today,
        analysts: prev.analysts,
        signatures: prev.signatures,
        // Clear volatile content
        summaryBar: "",
      });
    } catch (err) {
      alert("Failed to load yesterday: " + err.message);
    }
  };

  return (
    <button
      onClick={handleDuplicate}
      className="px-3.5 py-1.5 rounded-md border border-[var(--color-teal)] bg-transparent text-[var(--color-teal)] text-[10px] font-bold cursor-pointer uppercase tracking-wide whitespace-nowrap"
    >
      From Yesterday
    </button>
  );
}
