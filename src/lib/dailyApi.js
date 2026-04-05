import { supabase } from "./supabase";

export async function saveDaily(date, state) {
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

export async function loadDaily(date) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("dailies")
    .select("*")
    .eq("date", date)
    .single();
  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function listDailies(limit = 30) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("dailies")
    .select("id, date, title, created_at, updated_at")
    .order("date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function deleteDaily(id) {
  if (!supabase) return;
  const { error } = await supabase.from("dailies").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateDaily(sourceDate, targetDate) {
  if (!supabase) return null;
  const source = await loadDaily(sourceDate);
  if (!source) throw new Error("Source daily not found");
  return saveDaily(targetDate, { ...source.state, date: targetDate });
}
