import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type BudgetRow = Database["public"]["Tables"]["budgets"]["Row"];

export async function listBudgets(spaceId: string, referenceMonth: string): Promise<BudgetRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("budgets")
    .select("*")
    .eq("space_id", spaceId)
    .eq("reference_month", referenceMonth);
  if (error) throw error;
  return data ?? [];
}

export async function getActualSpendByCategory(
  spaceId: string,
  from: string,
  to: string,
): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("category_id, amount_cents, direction, nature")
    .eq("space_id", spaceId)
    .eq("nature", "despesa")
    .eq("direction", "saida")
    .is("deleted_at", null)
    .gte("competence_date", from)
    .lte("competence_date", to);

  if (error) throw error;

  const totals: Record<string, number> = {};
  for (const tx of data ?? []) {
    if (!tx.category_id) continue;
    totals[tx.category_id] = (totals[tx.category_id] ?? 0) + tx.amount_cents;
  }
  return totals;
}
