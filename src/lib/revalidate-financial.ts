import { revalidatePath } from "next/cache";

/**
 * Toda página que LÊ transações. Qualquer mutação de transação (criar/editar/
 * excluir, transferência, pagamento de fatura, classificação, importação) deve
 * chamar isto em vez de manter sua própria lista de revalidatePath — listas
 * divergentes já causaram dois bugs reais de página desatualizada (saldo em
 * /contas, Realizado em /planejamento).
 */
const TRANSACTION_READ_PATHS = [
  "/transacoes",
  "/visao-geral",
  "/revisar",
  "/planejamento",
  "/contas",
  "/cartoes",
  "/relatorios",
] as const;

export function revalidateTransactionData(): void {
  for (const path of TRANSACTION_READ_PATHS) {
    revalidatePath(path);
  }
}
