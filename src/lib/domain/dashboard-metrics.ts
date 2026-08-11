import type { Cents } from "@/lib/money/money";
import type { TransactionDirection, TransactionNature } from "@/lib/supabase/types";
import { EXPENSE_NATURES, REVENUE_NATURES } from "./labels";

export interface DashboardTransactionInput {
  amountCents: Cents;
  direction: TransactionDirection;
  nature: TransactionNature;
  classificationStatus: "classificado" | "nao_classificado" | "revisao_pendente";
  /** Presente apenas em lançamentos de resgate (investimento). */
  redemption?: {
    isDecomposed: boolean;
    netYieldCents: Cents;
    principalReturnedCents: Cents;
    pendingAmountCents: Cents;
  } | null;
}

export interface DashboardMetrics {
  entradasCaixaCents: Cents;
  saidasCaixaCents: Cents;
  receitasEfetivasCents: Cents;
  despesasCents: Cents;
  rendimentosLiquidosCents: Cents;
  resgatesPrincipalCents: Cents;
  aplicacoesCents: Cents;
  resultadoEconomicoCents: Cents;
  capitalConsumidoCents: Cents;
  percentualDespesasCobertasPorRendimentos: number | null;
  transacoesPendentesClassificacao: number;
  resgatesPendentesDecomposicao: number;
  temDadosIncompletos: boolean;
}

export function computeDashboardMetrics(transactions: DashboardTransactionInput[]): DashboardMetrics {
  let entradasCaixaCents = 0;
  let saidasCaixaCents = 0;
  let receitasEfetivasCents = 0;
  let despesasCents = 0;
  let rendimentosLiquidosCents = 0;
  let resgatesPrincipalCents = 0;
  let aplicacoesCents = 0;
  let transacoesPendentesClassificacao = 0;
  let resgatesPendentesDecomposicao = 0;

  for (const tx of transactions) {
    if (tx.direction === "entrada") {
      entradasCaixaCents += tx.amountCents;
    } else {
      saidasCaixaCents += tx.amountCents;
    }

    if (tx.classificationStatus !== "classificado") {
      transacoesPendentesClassificacao += 1;
    }

    if (tx.nature === "resgate_a_decompor" || (tx.redemption && !tx.redemption.isDecomposed)) {
      resgatesPendentesDecomposicao += 1;
    }

    if (REVENUE_NATURES.includes(tx.nature) && tx.direction === "entrada") {
      receitasEfetivasCents += tx.amountCents;
    }

    if (EXPENSE_NATURES.includes(tx.nature) && tx.direction === "saida") {
      despesasCents += tx.amountCents;
    }

    if (tx.nature === "resgate_investimento" && tx.redemption?.isDecomposed) {
      rendimentosLiquidosCents += tx.redemption.netYieldCents;
      resgatesPrincipalCents += tx.redemption.principalReturnedCents;
      receitasEfetivasCents += tx.redemption.netYieldCents;
    }

    if (tx.nature === "rendimento_investimento") {
      rendimentosLiquidosCents += tx.amountCents;
    }

    if (tx.nature === "aplicacao_financeira") {
      aplicacoesCents += tx.amountCents;
    }
  }

  const resultadoEconomicoCents = receitasEfetivasCents - despesasCents;
  const capitalConsumidoCents = Math.max(resgatesPrincipalCents - aplicacoesCents, 0);

  const percentualDespesasCobertasPorRendimentos =
    despesasCents > 0 ? rendimentosLiquidosCents / despesasCents : null;

  return {
    entradasCaixaCents,
    saidasCaixaCents,
    receitasEfetivasCents,
    despesasCents,
    rendimentosLiquidosCents,
    resgatesPrincipalCents,
    aplicacoesCents,
    resultadoEconomicoCents,
    capitalConsumidoCents,
    percentualDespesasCobertasPorRendimentos,
    transacoesPendentesClassificacao,
    resgatesPendentesDecomposicao,
    temDadosIncompletos: transacoesPendentesClassificacao > 0 || resgatesPendentesDecomposicao > 0,
  };
}
