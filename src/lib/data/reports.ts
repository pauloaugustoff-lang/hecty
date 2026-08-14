import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { getNonBrlAccountAndCardIds } from "@/lib/data/dashboard";
import { format, startOfMonth, subMonths } from "date-fns";

export interface RecurringExpense {
  normalizedDescription: string;
  sampleDescription: string;
  monthsPresent: number;
  averageCents: number;
  lastAmountCents: number;
}

/** Descrições que se repetem em pelo menos 3 dos últimos 6 meses — indício de gasto recorrente. */
export async function getRecurringExpenses(spaceId: string, monthsBack = 6): Promise<RecurringExpense[]> {
  const supabase = await createClient();
  const from = format(startOfMonth(subMonths(new Date(), monthsBack - 1)), "yyyy-MM-dd");

  // Paginado (6 meses de despesas passam do max_rows de 1000 do PostgREST) e
  // com a mesma exclusão de contas/cartões não-BRL do dashboard — sem ela,
  // uma assinatura em dólar aparecia aqui formatada como se fosse R$.
  const [rows, { accountIds: nonBrlAccountIds, cardIds: nonBrlCardIds }] = await Promise.all([
    fetchAllRows<{
      normalized_description: string;
      original_description: string;
      amount_cents: number;
      competence_date: string;
      account_id: string | null;
      card_id: string | null;
    }>((pageFrom, pageTo) =>
      supabase
        .from("transactions")
        .select("normalized_description, original_description, amount_cents, competence_date, account_id, card_id")
        .eq("space_id", spaceId)
        .eq("nature", "despesa")
        .eq("direction", "saida")
        .is("deleted_at", null)
        .gte("competence_date", from)
        .order("id")
        .range(pageFrom, pageTo),
    ),
    getNonBrlAccountAndCardIds(spaceId),
  ]);

  const data = rows.filter(
    (tx) => !(tx.account_id && nonBrlAccountIds.has(tx.account_id)) && !(tx.card_id && nonBrlCardIds.has(tx.card_id)),
  );

  const byDescription = new Map<string, { months: Set<string>; amounts: number[]; sample: string; last: { date: string; amount: number } }>();

  for (const tx of data ?? []) {
    const monthKey = tx.competence_date.slice(0, 7);
    const entry = byDescription.get(tx.normalized_description) ?? {
      months: new Set<string>(),
      amounts: [],
      sample: tx.original_description,
      last: { date: tx.competence_date, amount: tx.amount_cents },
    };
    entry.months.add(monthKey);
    entry.amounts.push(tx.amount_cents);
    if (tx.competence_date >= entry.last.date) entry.last = { date: tx.competence_date, amount: tx.amount_cents };
    byDescription.set(tx.normalized_description, entry);
  }

  return Array.from(byDescription.entries())
    .filter(([, v]) => v.months.size >= 3)
    .map(([normalizedDescription, v]) => ({
      normalizedDescription,
      sampleDescription: v.sample,
      monthsPresent: v.months.size,
      averageCents: Math.round(v.amounts.reduce((a, b) => a + b, 0) / v.amounts.length),
      lastAmountCents: v.last.amount,
    }))
    .sort((a, b) => b.monthsPresent - a.monthsPresent || b.averageCents - a.averageCents)
    .slice(0, 15);
}
