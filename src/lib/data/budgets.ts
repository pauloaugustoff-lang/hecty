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
    .select("id, category_id, amount_cents, direction, nature")
    .eq("space_id", spaceId)
    .eq("nature", "despesa")
    .eq("direction", "saida")
    .is("deleted_at", null)
    .gte("competence_date", from)
    .lte("competence_date", to);

  if (error) throw error;

  const rows = data ?? [];
  const despesaIds = rows.map((tx) => tx.id);
  const reductionByDespesaId = new Map<string, number>();

  if (despesaIds.length > 0) {
    const { data: links } = await supabase
      .from("transaction_reimbursement_links")
      .select("expense_transaction_id, allocated_amount_cents")
      .eq("space_id", spaceId)
      .in("expense_transaction_id", despesaIds);

    for (const link of links ?? []) {
      reductionByDespesaId.set(link.expense_transaction_id, (reductionByDespesaId.get(link.expense_transaction_id) ?? 0) + link.allocated_amount_cents);
    }
  }

  const totals: Record<string, number> = {};
  for (const tx of rows) {
    if (!tx.category_id) continue;
    const netAmount = Math.max(0, tx.amount_cents - (reductionByDespesaId.get(tx.id) ?? 0));
    totals[tx.category_id] = (totals[tx.category_id] ?? 0) + netAmount;
  }
  return totals;
}
