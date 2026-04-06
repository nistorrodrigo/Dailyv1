import { supabase } from "./supabase";
import type { DailyState } from "../types";

export interface Template {
  id: string;
  name: string;
  state: DailyState;
  created_at: string;
}

export async function saveTemplate(name: string, state: DailyState): Promise<Template | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("templates")
    .insert({ name, state })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listTemplates(): Promise<Template[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function deleteTemplate(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("templates").delete().eq("id", id);
  if (error) throw error;
}
