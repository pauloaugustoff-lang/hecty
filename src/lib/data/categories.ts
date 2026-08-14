import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { sortByName } from "@/lib/utils/sort";

export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];

export interface CategoryWithChildren extends CategoryRow {
  children: CategoryRow[];
}

export async function listCategories(spaceId: string, options?: { includeArchived?: boolean }): Promise<CategoryRow[]> {
  const supabase = await createClient();
  let query = supabase.from("categories").select("*").eq("space_id", spaceId);

  if (!options?.includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data, error } = await query;
  if (error) throw error;
  // Ordem alfabética (não a "sort_order" antiga), incluindo categorias
  // criadas depois — a coleção sempre chega ordenada, sem depender de cada
  // consumidor lembrar de ordenar.
  return sortByName(data ?? []);
}

export function groupCategoriesByParent(categories: CategoryRow[]): CategoryWithChildren[] {
  const parents = categories.filter((c) => !c.parent_id);
  const byParent = new Map<string, CategoryRow[]>();

  for (const category of categories) {
    if (category.parent_id) {
      const list = byParent.get(category.parent_id) ?? [];
      list.push(category);
      byParent.set(category.parent_id, list);
    }
  }

  return parents.map((parent) => ({ ...parent, children: byParent.get(parent.id) ?? [] }));
}
