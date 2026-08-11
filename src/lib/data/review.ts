import { createClient } from "@/lib/supabase/server";
import type { TransactionWithRelations } from "./transactions";

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
  options?: { search?: string },
): Promise<TransactionWithRelations[]> {
  const supabase = await createClient();

  let query = supabase
    .from("transactions")
    .select(SELECT_WITH_RELATIONS)
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .neq("classification_status", "classificado")
    .order("normalized_description")
    .order("movement_date", { ascending: false })
    .limit(500);

  if (options?.search) {
    query = query.ilike("normalized_description", `%${options.search.toUpperCase()}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data as unknown as TransactionWithRelations[]) ?? [];
}
