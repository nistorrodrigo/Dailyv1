import React from "react";
import useDailyStore from "../store/useDailyStore";
import { loadDaily } from "../lib/dailyApi";
import { supabase } from "../lib/supabase";
import { DEFAULT_STATE } from "../constants/defaultState";
import { toast } from "../store/useToastStore";
import { todayLocal } from "../utils/dates";
import { carryForwardYesterday } from "../utils/carryForward";

export default function DuplicateYesterdayBtn(): React.ReactElement {
  const handleDuplicate = async (): Promise<void> => {
    // Use local-TZ "yesterday" so the analyst at 23:00 BUE on the 30th
    // pulls the 29th, not the 1st of the next month (which is what
    // toISOString would give them since UTC has already rolled over).
    const today = todayLocal();
    const yesterday = new Date(today + "T12:00:00");
    yesterday.setDate(yesterday.getDate() - 1);
    const yDate = yesterday.toLocaleDateString("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    if (!supabase) {
      // Without Supabase, just reset with today's date keeping the
      // current state's analysts/signatures (no yesterday to load).
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
      const confirmMsg =
        `Carry forward setup from ${yDate} to ${today}?\n\n` +
        `KEPT: analyst coverage, signatures, section layout, macro estimates structure, ` +
        `macro block titles, equity-pick tickers.\n\n` +
        `RESET: summary bar, macro bodies, pick rationales, FI ideas, flows, events, ` +
        `corporate notes, snapshot, top movers, chart, BCRA dashboard.\n\n` +
        `Today's content needs to be filled in fresh.`;
      if (!window.confirm(confirmMsg)) return;

      // `loadDaily` returns a bare DailyState shape from Supabase. The
      // runtime row also has the `flows` extension fields persisted
      // alongside, so cast through a wider type for the carry-forward
      // helper. If the row is missing flows (older schema), use empty
      // strings so carry-forward's `seed.flows` defaults take over.
      const yesterdayWithFlows = {
        flows: { global: "", local: "", positioning: "" },
        ...(daily.state as unknown as Record<string, unknown>),
      } as Parameters<typeof carryForwardYesterday>[0];
      useDailyStore.setState(carryForwardYesterday(yesterdayWithFlows, today));
      toast.success(`Setup carried forward from ${yDate}. Fill in today's content.`);
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
