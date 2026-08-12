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
    const { data: linkedReembolsos } = await supabase
      .from("transactions")
      .select("amount_cents, linked_transaction_id")
      .eq("space_id", spaceId)
      .eq("nature", "reembolso")
      .is("deleted_at", null)
      .in("linked_transaction_id", despesaIds);

    for (const r of linkedReembolsos ?? []) {
      if (!r.linked_transaction_id) continue;
      reductionByDespesaId.set(r.linked_transaction_id, (reductionByDespesaId.get(r.linked_transaction_id) ?? 0) + r.amount_cents);
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
