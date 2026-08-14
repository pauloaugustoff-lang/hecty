import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { sortByName } from "@/lib/utils/sort";

export type TagRow = Database["public"]["Tables"]["tags"]["Row"];

export async function listTags(spaceId: string): Promise<TagRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tags").select("*").eq("space_id", spaceId);
  if (error) throw error;
  return sortByName(data ?? []);
}
