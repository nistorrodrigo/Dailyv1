import React from "react";
import useDailyStore from "../store/useDailyStore";
import { loadDaily } from "../lib/dailyApi";
import { supabase } from "../lib/supabase";
import { DEFAULT_STATE } from "../constants/defaultState";
import { toast } from "../store/useToastStore";

export default function DuplicateYesterdayBtn(): React.ReactElement {
  const handleDuplicate = async (): Promise<void> => {
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
        toast.info(`No daily found for ${yDate}. Try loading from History instead.`);
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
      toast.error("Failed to load yesterday: " + (err as Error).message);
    }
  };

  return (
    <button
      onClick={handleDuplicate}
      style={{
        padding: "6px 12px",
        borderRadius: 6,
        border: "1px solid rgba(255,255,255,0.18)",
        background: "transparent",
        color: "var(--color-teal)",
        fontSize: 10,
        fontWeight: 700,
        cursor: "pointer",
        textTransform: "uppercase",
        letterSpacing: 0.5,
        whiteSpace: "nowrap",
        transition: "all 120ms ease",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >
      From Yesterday
    </button>
  );
}
