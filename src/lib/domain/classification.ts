import type { TransactionNature } from "@/lib/supabase/types";

/**
 * Regra única de status de classificação. Antes cada escritor (diálogo de
 * lançamento, classificação em massa do Revisar, importação, regras) derivava
 * o status do seu jeito — o do Revisar hardcodava "classificado" e tirava da
 * fila lançamentos que ainda precisavam de revisão (ex.: resgate a decompor,
 * despesa sem categoria).
 */
export function classificationStatusFor(
  nature: TransactionNature,
  hasCategory: boolean,
): "classificado" | "nao_classificado" {
  if (nature === "nao_classificado" || nature === "resgate_a_decompor") return "nao_classificado";
  if (nature === "transferencia_entre_contas" || nature === "pagamento_cartao") return "classificado";
  return hasCategory ? "classificado" : "nao_classificado";
}
