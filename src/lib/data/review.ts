import { createClient } from "@/lib/supabase/server";
import type { TransactionWithRelations, TransactionSortBy, TransactionSortDir } from "./transactions";

const SELECT_WITH_RELATIONS = `
  *,
  account:accounts(id, name, color),
  card:cards!transactions_card_id_fkey(id, name),
  category:categories!transactions_category_id_fkey(id, name, color),
  subcategory:categories!transactions_subcategory_id_fkey(id, name),
  redemption:redemption_details(*)
`;

export async function listReviewTransactions(
  spaceId: string,
  options?: { search?: string; sortBy?: TransactionSortBy; sortDir?: TransactionSortDir },
): Promise<TransactionWithRelations[]> {
  const supabase = await createClient();

  let query = supabase
    .from("transactions")
    .select(SELECT_WITH_RELATIONS)
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .neq("classification_status", "classificado");

  if (options?.sortBy) {
    const ascending = options.sortDir === "asc";
    switch (options.sortBy) {
      case "value":
        query = query.order("amount_cents", { ascending });
        break;
      case "description":
        query = query.order("original_description", { ascending });
        break;
      case "nature":
        query = query.order("nature", { ascending });
        break;
      case "account":
        query = query
          .order("name", { ascending, nullsFirst: false, referencedTable: "account" })
          .order("name", { ascending, nullsFirst: false, referencedTable: "card" });
        break;
      case "date":
        query = query.order("movement_date", { ascending });
        break;
    }
  } else {
    // Padrão: agrupa descrições parecidas, para facilitar classificar várias
    // de uma vez (ver o botão "selecionar grupo" na tabela de revisão).
    query = query.order("normalized_description").order("movement_date", { ascending: false });
  }

  query = query.limit(500);

  if (options?.search) {
    query = query.ilike("normalized_description", `%${options.search.toUpperCase()}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as TransactionWithRelations[]) ?? [];
}
