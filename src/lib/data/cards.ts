import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type CardRow = Database["public"]["Tables"]["cards"]["Row"];

export async function listCards(spaceId: string, options?: { includeArchived?: boolean }): Promise<CardRow[]> {
  const supabase = await createClient();
  let query = supabase.from("cards").select("*").eq("space_id", spaceId).order("name");

  if (!options?.includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getCard(id: string): Promise<CardRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("cards").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
