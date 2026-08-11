import { createClient } from "@/lib/supabase/server";
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

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("card_id, amount_cents, direction, movement_date")
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .not("card_id", "is", null);

  if (error) throw error;

  for (const card of cards) {
    const period = getStatementPeriod(card.closing_day, card.due_day, now);
    const start = format(period.start, "yyyy-MM-dd");
    const end = format(period.end, "yyyy-MM-dd");

    totals[card.id] = (transactions ?? [])
      .filter((tx) => tx.card_id === card.id && tx.movement_date >= start && tx.movement_date <= end)
      .reduce((sum, tx) => sum + (tx.direction === "saida" ? tx.amount_cents : -tx.amount_cents), 0);
  }

  return totals;
}
