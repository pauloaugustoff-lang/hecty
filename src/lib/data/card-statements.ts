import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { getStatementPeriod } from "@/lib/transactions/cards";
import { format } from "date-fns";

/** Total da fatura em aberto de cada cartão (compras não pagas no ciclo atual). */
export async function getOpenStatementTotals(
  spaceId: string,
  cards: { id: string; closing_day: number; due_day: number }[],
): Promise<Record<string, number>> {
  if (cards.length === 0) return {};

  const supabase = await createClient();
  const now = new Date();
  const totals: Record<string, number> = {};

  const periods = new Map(cards.map((card) => [card.id, getStatementPeriod(card.closing_day, card.due_day, now)]));
  // Só o ciclo atual interessa — sem este corte a consulta trazia TODA
  // transação de cartão do espaço e, passando do max_rows de 1000 do
  // PostgREST, o total da fatura truncava silenciosamente.
  const earliestStart = Array.from(periods.values())
    .map((p) => p.start)
    .reduce((min, d) => (d < min ? d : min));

  const transactions = await fetchAllRows<{
    card_id: string | null;
    amount_cents: number;
    direction: "entrada" | "saida";
    movement_date: string;
  }>((pageFrom, pageTo) =>
    supabase
      .from("transactions")
      .select("card_id, amount_cents, direction, movement_date")
      .eq("space_id", spaceId)
      .is("deleted_at", null)
      .not("card_id", "is", null)
      .gte("movement_date", format(earliestStart, "yyyy-MM-dd"))
      .order("id")
      .range(pageFrom, pageTo),
  );

  for (const card of cards) {
    const period = periods.get(card.id)!;
    const start = format(period.start, "yyyy-MM-dd");
    const end = format(period.end, "yyyy-MM-dd");

    totals[card.id] = transactions
      .filter((tx) => tx.card_id === card.id && tx.movement_date >= start && tx.movement_date <= end)
      .reduce((sum, tx) => sum + (tx.direction === "saida" ? tx.amount_cents : -tx.amount_cents), 0);
  }

  return totals;
}
