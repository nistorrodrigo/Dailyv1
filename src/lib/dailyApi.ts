import { supabase } from "./supabase";
import type { DailyState } from "../types";

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
