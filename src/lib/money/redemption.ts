import type { Cents } from "./money";

/**
 * Um resgate de investimento pode trazer, além do valor total, a
 * devolução de principal e o rendimento líquido (após imposto e taxas).
 * Enquanto essa decomposição não é conhecida, nada do valor pode ser
 * tratado como receita — o lançamento fica como "resgate a decompor".
 */
export interface RedemptionBreakdown {
  totalAmountCents: Cents;
  principalCents?: Cents | null;
  grossYieldCents?: Cents | null;
  taxCents?: Cents | null;
  feesCents?: Cents | null;
  netYieldCents?: Cents | null;
}

export interface RedemptionAnalysis {
  isDecomposed: boolean;
  /** Parte do resgate que é receita efetiva (rendimento líquido). */
  netYieldCents: Cents;
  /** Parte do resgate que é apenas retorno de capital (não é receita). */
  principalReturnedCents: Cents;
  /** Parte do total ainda não classificada (0 quando decomposto). */
  pendingAmountCents: Cents;
  /** total - (principal + rendimento líquido); deveria ser 0 quando consistente. */
  discrepancyCents: Cents;
}

export function analyzeRedemption(breakdown: RedemptionBreakdown): RedemptionAnalysis {
  const grossYield = breakdown.grossYieldCents ?? null;
  const tax = breakdown.taxCents ?? 0;
  const fees = breakdown.feesCents ?? 0;

  const netYield = breakdown.netYieldCents ?? (grossYield !== null ? grossYield - tax - fees : null);
  const principal = breakdown.principalCents ?? null;

  const isDecomposed = principal !== null && netYield !== null;

  if (!isDecomposed) {
    return {
      isDecomposed: false,
      netYieldCents: 0,
      principalReturnedCents: 0,
      pendingAmountCents: breakdown.totalAmountCents,
      discrepancyCents: 0,
    };
  }

  return {
    isDecomposed: true,
    netYieldCents: netYield,
    principalReturnedCents: principal,
    pendingAmountCents: 0,
    discrepancyCents: breakdown.totalAmountCents - (principal + netYield),
  };
}

/** A natureza correta do lançamento de acordo com o que se sabe do resgate. */
export function redemptionNature(breakdown: Pick<RedemptionBreakdown, "principalCents" | "netYieldCents" | "grossYieldCents">): "resgate_investimento" | "resgate_a_decompor" {
  const hasPrincipal = breakdown.principalCents !== null && breakdown.principalCents !== undefined;
  const hasYield =
    (breakdown.netYieldCents !== null && breakdown.netYieldCents !== undefined) ||
    (breakdown.grossYieldCents !== null && breakdown.grossYieldCents !== undefined);

  return hasPrincipal && hasYield ? "resgate_investimento" : "resgate_a_decompor";
}
