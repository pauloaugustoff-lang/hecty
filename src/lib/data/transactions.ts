import { createClient } from "@/lib/supabase/server";
import type { Database, TransactionDirection, TransactionNature } from "@/lib/supabase/types";

export type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];
export type RedemptionRow = Database["public"]["Tables"]["redemption_details"]["Row"];

export interface LinkedExpenseSummary {
  expense_transaction_id: string;
  allocated_amount_cents: number;
  expense: { id: string; original_description: string; amount_cents: number; movement_date: string } | null;
}

export interface TransactionWithRelations extends TransactionRow {
  account: { id: string; name: string; color: string; currency: string } | null;
  card: { id: string; name: string; payment_account: { currency: string } | null } | null;
  category: { id: string; name: string; color: string } | null;
  subcategory: { id: string; name: string } | null;
  redemption: RedemptionRow | null;
  /** Preenchido quando nature = "reembolso"/"estorno": despesas cobertas por este lançamento. */
  reimbursement_links: LinkedExpenseSummary[];
}

export type TransactionSortBy = "date" | "value" | "description" | "account" | "category" | "nature";
export type TransactionSortDir = "asc" | "desc";

export interface TransactionFilters {
  from?: string;
  to?: string;
  accountId?: string;
  cardId?: string;
  categoryId?: string;
  subcategoryId?: string;
  nature?: TransactionNature;
  direction?: TransactionDirection;
  tag?: string;
  onlyUnclassified?: boolean;
  search?: string;
  minAmountCents?: number;
  maxAmountCents?: number;
  limit?: number;
  offset?: number;
  sortBy?: TransactionSortBy;
  sortDir?: TransactionSortDir;
}

const SELECT_WITH_RELATIONS = `
  *,
  account:accounts(id, name, color, currency),
  card:cards!transactions_card_id_fkey(id, name, payment_account:accounts!cards_payment_account_id_fkey(currency)),
  category:categories!transactions_category_id_fkey(id, name, color),
  subcategory:categories!transactions_subcategory_id_fkey(id, name),
  redemption:redemption_details(*),
  reimbursement_links:transaction_reimbursement_links!reimbursement_transaction_id(
    expense_transaction_id,
    allocated_amount_cents,
    expense:transactions!expense_transaction_id(id, original_description, amount_cents, movement_date)
  )
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
  if (filters.subcategoryId) query = query.eq("subcategory_id", filters.subcategoryId);
  else if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.nature) query = query.eq("nature", filters.nature);
  if (filters.direction) query = query.eq("direction", filters.direction);
  if (filters.tag) query = query.contains("tags", [filters.tag]);
  if (filters.onlyUnclassified) query = query.neq("classification_status", "classificado");
  if (filters.search) {
    query = query.ilike("normalized_description", `%${filters.search.toUpperCase()}%`);
  }
  if (filters.minAmountCents != null) query = query.gte("amount_cents", filters.minAmountCents);
  if (filters.maxAmountCents != null) query = query.lte("amount_cents", filters.maxAmountCents);

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
