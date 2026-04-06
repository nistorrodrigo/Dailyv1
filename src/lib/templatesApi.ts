import { supabase } from "./supabase";

export async function saveTemplate(name, state) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("templates")
    .insert({ name, state })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listTemplates() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function deleteTemplate(id) {
  if (!supabase) return;
  const { error } = await supabase.from("templates").delete().eq("id", id);
  if (error) throw error;
}
