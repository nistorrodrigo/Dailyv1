import { supabase } from "./supabase";

export interface Recipient {
  id: string;
  email: string;
  name: string;
  active: boolean;
}

export async function listRecipients(): Promise<Recipient[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("recipients")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addRecipient(email: string, name: string = ""): Promise<Recipient | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("recipients")
    .insert({ email, name, active: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function toggleRecipient(id: string, active: boolean): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from("recipients")
    .update({ active })
    .eq("id", id);
  if (error) throw error;
}

export async function removeRecipient(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("recipients").delete().eq("id", id);
  if (error) throw error;
}
