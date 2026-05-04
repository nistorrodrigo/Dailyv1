import { supabase } from "./supabase";
import type { DailyState } from "../types";
import { addDaysLocal } from "../utils/dates";

interface DailyRecord {
  id: string;
  date: string;
  title: string;
  state: DailyState;
  created_at: string;
  updated_at: string;
}

interface DailyListItem {
  id: string;
  date: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export async function saveDaily(date: string, state: DailyState): Promise<DailyRecord | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("dailies")
    .upsert(
      { date, state, title: `Argentina Daily - ${date}`, updated_at: new Date().toISOString() },
      { onConflict: "date" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadDaily(date: string): Promise<DailyRecord | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("dailies")
    .select("*")
    .eq("date", date)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function listDailies(limit: number = 30): Promise<DailyListItem[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("dailies")
    .select("id, date, title, created_at, updated_at")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function deleteDaily(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("dailies").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateDaily(sourceDate: string, targetDate: string): Promise<DailyRecord | null> {
  if (!supabase) return null;
  const source = await loadDaily(sourceDate);
  if (!source) throw new Error("Source daily not found");
  return saveDaily(targetDate, { ...source.state, date: targetDate });
}

/**
 * Find the most recent daily that exists strictly before `today` —
 * walking backward up to `maxLookbackDays` calendar days, loading
 * each candidate from Supabase and stopping at the first hit. The
 * DB itself is the source of truth for "is this a working day for
 * the desk", so we don't need a hard-coded holiday calendar.
 *
 * Returns the daily record + the date we found it under, or null if
 * nothing in the lookback window exists. Used by the carry-forward
 * button so a Monday morning click pulls Friday's daily (skipping
 * the weekend's empty rows) rather than failing because "yesterday"
 * was Sunday.
 *
 * `today` is a `YYYY-MM-DD` string in the analyst's local timezone
 * (use `todayLocal()`). `maxLookbackDays` defaults to 7 — covers a
 * typical long weekend or Easter break without thrashing the DB.
 */
export async function findMostRecentDailyBefore(
  today: string,
  maxLookbackDays: number = 7,
): Promise<{ date: string; record: DailyRecord } | null> {
  if (!supabase) return null;
  for (let offset = 1; offset <= maxLookbackDays; offset++) {
    const probeDate = addDaysLocal(today, -offset);
    const record = await loadDaily(probeDate);
    if (record?.state) return { date: probeDate, record };
  }
  return null;
}
