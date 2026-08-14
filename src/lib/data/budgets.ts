import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import { fetchTransactions } from "@/lib/data/dashboard";

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

/**
 * Reutiliza a mesma consulta do dashboard (paginada, com abatimento de
 * reembolso/estorno e exclusão de contas não-BRL) em vez de reimplementar as
 * três regras aqui — as cópias já tinham divergido entre si, e uma delas
 * truncava no limite de 1000 linhas do PostgREST. Com o React cache() do
 * fetchTransactions, a janela consultada pelo Planejamento sai de graça
 * quando coincide com a do dashboard.
 */
export async function getActualSpendByCategory(
  spaceId: string,
  from: string,
  to: string,
): Promise<Record<string, number>> {
  const rows = await fetchTransactions(spaceId, from, to);

  const totals: Record<string, number> = {};
  for (const tx of rows) {
    if (tx.nature !== "despesa" || tx.direction !== "saida" || !tx.category_id) continue;
    totals[tx.category_id] = (totals[tx.category_id] ?? 0) + tx.amount_cents;
  }
  return totals;
}
