import type { TransactionWithRelations } from "@/lib/data/transactions";

/**
 * Moeda do lançamento: da própria conta, ou da conta que paga o cartão. Sem
 * nenhuma delas, assume BRL. Módulo separado (em vez de morar em
 * lib/data/transactions.ts) porque esse arquivo importa createClient do lado
 * servidor — importar um valor de lá quebraria o bundle de componentes
 * cliente que só precisam desta função pura.
 */
export function transactionCurrency(tx: TransactionWithRelations): string {
  return tx.account?.currency ?? tx.card?.payment_account?.currency ?? "BRL";
}
