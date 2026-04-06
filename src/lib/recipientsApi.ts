import { supabase } from "./supabase";

export async function listRecipients() {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("recipients")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addRecipient(email, name = "") {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("recipients")
    .insert({ email, name, active: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleRecipient(id, active) {
  if (!supabase) return;
  const { error } = await supabase
    .from("recipients")
    .update({ active })
    .eq("id", id);
  if (error) throw error;
}

export async function removeRecipient(id) {
  if (!supabase) return;
  const { error } = await supabase.from("recipients").delete().eq("id", id);
  if (error) throw error;
}
