import type { TransactionNature } from "@/lib/supabase/types";

/**
 * Naturezas em que a categoria é opcional: a própria natureza já é a
 * classificação. Transferência/pagamento de cartão são neutras por definição;
 * reembolso/estorno se explicam pelo vínculo com a despesa coberta (categoria
 * própria é rara); ajuste/empréstimo/repasse são neutras no resultado
 * econômico; e "resgate a decompor" já diz o que o lançamento é — a
 * decomposição pendente (principal × rendimento) é acompanhada à parte, pelo
 * aviso próprio de resgates no dashboard, não pela fila do Revisar.
 */
const CATEGORY_OPTIONAL_NATURES: ReadonlySet<TransactionNature> = new Set([
  "transferencia_entre_contas",
  "pagamento_cartao",
  "reembolso",
  "estorno",
  "repasse",
  "ajuste",
  "emprestimo",
  "resgate_a_decompor",
]);

/**
 * Regra única de status de classificação. Antes cada escritor (diálogo de
 * lançamento, classificação em massa do Revisar, importação, regras) derivava
 * o status do seu jeito — o do Revisar hardcodava "classificado" e tirava da
 * fila lançamentos que ainda precisavam de revisão (ex.: despesa sem
 * categoria).
 */
export function classificationStatusFor(
  nature: TransactionNature,
  hasCategory: boolean,
): "classificado" | "nao_classificado" {
  if (nature === "nao_classificado") return "nao_classificado";
  if (CATEGORY_OPTIONAL_NATURES.has(nature)) return "classificado";
  return hasCategory ? "classificado" : "nao_classificado";
}
