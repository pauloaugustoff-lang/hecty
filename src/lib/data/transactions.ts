import { createClient } from "@/lib/supabase/server";
import type { Database, TransactionNature } from "@/lib/supabase/types";

export type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
export type RedemptionRow = Database["public"]["Tables"]["redemption_details"]["Row"];

export interface TransactionWithRelations extends TransactionRow {
  account: { id: string; name: string; color: string } | null;
  card: { id: string; name: string } | null;
  category: { id: string; name: string; color: string } | null;
  subcategory: { id: string; name: string } | null;
  redemption: RedemptionRow | null;
  /** Preenchido quando nature = "reembolso" e há vínculo com a despesa reembolsada. */
  linked_expense: { id: string; original_description: string; amount_cents: number } | null;
}

export type TransactionSortBy = "date" | "value" | "description" | "account" | "category" | "nature";
export type TransactionSortDir = "asc" | "desc";

export interface TransactionFilters {
  from?: string;
  to?: string;
  accountId?: string;
  cardId?: string;
  categoryId?: string;
  nature?: TransactionNature;
  onlyUnclassified?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: TransactionSortBy;
  sortDir?: TransactionSortDir;
}

const SELECT_WITH_RELATIONS = `
  *,
  account:accounts(id, name, color),
  card:cards!transactions_card_id_fkey(id, name),
  category:categories!transactions_category_id_fkey(id, name, color),
  subcategory:categories!transactions_subcategory_id_fkey(id, name),
  redemption:redemption_details(*),
  linked_expense:transactions!linked_transaction_id(id, original_description, amount_cents)
`;

export async function listTransactions(
  spaceId: string,
  filters: TransactionFilters = {},
): Promise<{ rows: TransactionWithRelations[]; count: number }> {
  const supabase = await createClient();

  let query = supabase
    .from("transactions")
    .select(SELECT_WITH_RELATIONS, { count: "exact" })
    .eq("space_id", spaceId)
    .is("deleted_at", null);

  const ascending = filters.sortDir === "asc";
  switch (filters.sortBy) {
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
    case "category":
      query = query.order("name", { ascending, nullsFirst: false, referencedTable: "category" });
      break;
    case "date":
    default:
      query = query.order("movement_date", { ascending });
      break;
  }
  query = query.order("created_at", { ascending: false });

  if (filters.from) query = query.gte("movement_date", filters.from);
  if (filters.to) query = query.lte("movement_date", filters.to);
  if (filters.accountId) query = query.eq("account_id", filters.accountId);
  if (filters.cardId) query = query.eq("card_id", filters.cardId);
  if (filters.categoryId) query = query.or(`category_id.eq.${filters.categoryId},subcategory_id.eq.${filters.categoryId}`);
  if (filters.nature) query = query.eq("nature", filters.nature);
  if (filters.onlyUnclassified) query = query.neq("classification_status", "classificado");
  if (filters.search) {
    query = query.ilike("normalized_description", `%${filters.search.toUpperCase()}%`);
  }

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) throw error;

  return { rows: (data as unknown as TransactionWithRelations[]) ?? [], count: count ?? 0 };
}

export async function getTransaction(id: string): Promise<TransactionWithRelations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("transactions").select(SELECT_WITH_RELATIONS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as TransactionWithRelations | null;
}
