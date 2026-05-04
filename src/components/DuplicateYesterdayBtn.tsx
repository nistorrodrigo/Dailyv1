import React from "react";
import useDailyStore from "../store/useDailyStore";
import { findMostRecentDailyBefore } from "../lib/dailyApi";
import { supabase } from "../lib/supabase";
import { DEFAULT_STATE } from "../constants/defaultState";
import { toast } from "../store/useToastStore";
import { todayLocal } from "../utils/dates";
import { carryForwardYesterday } from "../utils/carryForward";

export default function DuplicateYesterdayBtn(): React.ReactElement {
  const handleDuplicate = async (): Promise<void> => {
    const today = todayLocal();

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
      // Walk backward up to 7 days to find the most recent daily that
      // actually exists. Handles weekends (Mon → Fri, skipping Sat/Sun)
      // and Argentine feriados (no calendar needed; the DB is the
      // source of truth — empty days have no row to load).
      const found = await findMostRecentDailyBefore(today, 7);
      if (!found) {
        toast.info(`No daily found in the last 7 days. Try loading from History instead.`);
        return;
      }
      const { date: sourceDate, record } = found;

      // Show the analyst exactly which date we're carrying forward
      // from — important when it's not literally yesterday (Mon
      // morning click should be obvious that it's pulling Friday).
      const litYesterday = (() => {
        const y = new Date(today + "T12:00:00");
        y.setDate(y.getDate() - 1);
        return y.toLocaleDateString("en-CA", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });
      })();
      const sourceLabel = sourceDate === litYesterday ? `yesterday (${sourceDate})` : `${sourceDate}`;
      const confirmMsg =
        `Carry forward setup from ${sourceLabel} to ${today}?\n\n` +
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
        ...(record.state as unknown as Record<string, unknown>),
      } as Parameters<typeof carryForwardYesterday>[0];
      useDailyStore.setState(carryForwardYesterday(yesterdayWithFlows, today));
      toast.success(`Setup carried forward from ${sourceLabel}. Fill in today's content.`);
    } catch (err) {
      toast.error("Failed to load: " + (err as Error).message);
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
