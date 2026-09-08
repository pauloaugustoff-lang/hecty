import type { AssetPricingMode, InvestmentMovementType } from "@/lib/supabase/types";
import { accruedValueCents, type RateSeries, type RateTerms } from "./fixed-income";

/**
 * O motor de posição: pega o histórico de movimentos de um ativo e devolve
 * quanto se tem, quanto custou e quanto vale hoje.
 *
 * Custo por PREÇO MÉDIO, que é a convenção da Receita Federal para apuração de
 * ganho de capital no Brasil — e não FIFO. Vender metade da posição realiza
 * lucro sobre o preço médio de toda ela, não sobre o lote mais antigo.
 */

export interface PositionMovement {
  movement_type: InvestmentMovementType;
  movement_date: string;
  quantity: number;
  amount_cents: number;
  fees_cents: number;
  tax_cents: number;
  split_factor: number | null;
}

export interface AssetPosition {
  quantity: number;
  /** Custo da posição em aberto (preço médio x quantidade). */
  investedCents: number;
  /** Custo unitário médio; 0 quando não há posição. */
  averageCostCents: number;
  /** Tudo o que já saiu do bolso para este ativo, incluindo taxas de compra. */
  contributedCents: number;
  /** Tudo o que já voltou de resgates, líquido de taxas e imposto. */
  withdrawnCents: number;
  /** Dividendos, JCP e rendimentos recebidos, líquidos de imposto. */
  incomeCents: number;
  /** Taxas e impostos avulsos (custódia, come-cotas) — não entram no custo. */
  costsCents: number;
  /** Lucro/prejuízo já realizado nos resgates. */
  realizedPnlCents: number;

  /** Valor de mercado hoje; null quando não há preço nem saldo informado. */
  marketValueCents: number | null;
  unrealizedPnlCents: number | null;
  /** Resultado total: valorização + realizado + proventos − custos. */
  totalReturnCents: number | null;
  /** Resultado sobre o capital aportado, em fração (0,12 = +12%). */
  returnRate: number | null;

  valuationSource: AssetPricingMode | "indisponivel";
  valuationDate: string | null;
  /** Preço unitário usado, quando a precificação é por cotação. */
  priceCents: number | null;
}

export interface ValuationContext {
  asOf: string;
  /** Preço unitário mais recente na moeda do ativo, para pricing_mode 'cotacao'. */
  quote?: { closeCents: number; quoteDate: string } | null;
  /** Termos e séries do índice, para pricing_mode 'indexado'. */
  rate?: { terms: RateTerms; series: RateSeries } | null;
  /** Saldo digitado pelo usuário, para pricing_mode 'manual'. */
  manual?: { valueCents: number; valueDate: string | null } | null;
}

/** Ordem estável: por data e, no mesmo dia, pela ordem que afeta a quantidade
 * antes da que depende dela (desdobramento antes de resgate, por exemplo). */
const SAME_DAY_ORDER: Record<InvestmentMovementType, number> = {
  desdobramento: 0,
  bonificacao: 1,
  aporte: 2,
  provento: 3,
  resgate: 4,
  taxa: 5,
  imposto: 6,
  ajuste: 7,
};

export function sortMovements<T extends PositionMovement>(movements: T[]): T[] {
  return [...movements].sort((a, b) => {
    if (a.movement_date !== b.movement_date) return a.movement_date < b.movement_date ? -1 : 1;
    return SAME_DAY_ORDER[a.movement_type] - SAME_DAY_ORDER[b.movement_type];
  });
}

interface CostBasis {
  quantity: number;
  investedCents: number;
  contributedCents: number;
  withdrawnCents: number;
  incomeCents: number;
  costsCents: number;
  realizedPnlCents: number;
}

function walkMovements(movements: PositionMovement[]): CostBasis {
  const basis: CostBasis = {
    quantity: 0,
    investedCents: 0,
    contributedCents: 0,
    withdrawnCents: 0,
    incomeCents: 0,
    costsCents: 0,
    realizedPnlCents: 0,
  };

  for (const m of sortMovements(movements)) {
    switch (m.movement_type) {
      case "aporte": {
        // Corretagem e emolumentos entram no custo de aquisição — é assim que
        // a Receita calcula o preço médio, e é o que reduz o ganho na venda.
        const cost = m.amount_cents + m.fees_cents;
        basis.quantity += m.quantity;
        basis.investedCents += cost;
        basis.contributedCents += cost;
        break;
      }

      case "bonificacao": {
        // Quantidade nova sem desembolso: o custo total não muda, então o
        // preço médio cai sozinho.
        basis.quantity += m.quantity;
        basis.investedCents += m.amount_cents;
        break;
      }

      case "desdobramento": {
        // Só reescala a quantidade; o custo total permanece, e com isso o
        // preço médio se ajusta na proporção certa.
        basis.quantity *= m.split_factor ?? 1;
        break;
      }

      case "resgate": {
        const proceeds = m.amount_cents - m.fees_cents - m.tax_cents;
        let costOut: number;

        if (m.quantity > 0 && basis.quantity > 0) {
          const averageCost = basis.investedCents / basis.quantity;
          costOut = Math.round(Math.min(averageCost * m.quantity, basis.investedCents));
          basis.quantity = Math.max(0, basis.quantity - m.quantity);
        } else {
          // Resgate sem quantidade (renda fixa, fundo): baixa o principal até
          // onde ele der e o excedente vira rendimento realizado.
          costOut = Math.min(m.amount_cents, basis.investedCents);
        }

        basis.investedCents = Math.max(0, basis.investedCents - costOut);
        basis.withdrawnCents += proceeds;
        basis.realizedPnlCents += proceeds - costOut;
        // Zerou a posição: qualquer resíduo de custo por arredondamento sai
        // agora, senão fica um centavo eterno de "investido" sem quantidade.
        if (basis.quantity === 0) basis.investedCents = 0;
        break;
      }

      case "provento":
        basis.incomeCents += m.amount_cents - m.tax_cents - m.fees_cents;
        break;

      case "taxa":
      case "imposto":
        basis.costsCents += m.amount_cents + m.fees_cents + m.tax_cents;
        break;

      case "ajuste":
        // Correção manual de posição: soma quantidade e custo como vierem,
        // sem regra própria — é a válvula de escape para casos que o modelo
        // ainda não cobre (herança, transferência de custódia, migração).
        basis.quantity += m.quantity;
        basis.investedCents = Math.max(0, basis.investedCents + m.amount_cents);
        break;
    }
  }

  return basis;
}

function marketValueOf(
  pricingMode: AssetPricingMode,
  basis: CostBasis,
  movements: PositionMovement[],
  ctx: ValuationContext,
): { valueCents: number | null; source: AssetPricingMode | "indisponivel"; date: string | null; priceCents: number | null } {
  if (pricingMode === "cotacao") {
    if (!ctx.quote) return { valueCents: null, source: "indisponivel", date: null, priceCents: null };
    return {
      valueCents: Math.round(basis.quantity * ctx.quote.closeCents),
      source: "cotacao",
      date: ctx.quote.quoteDate,
      priceCents: ctx.quote.closeCents,
    };
  }

  if (pricingMode === "indexado") {
    if (!ctx.rate) return { valueCents: null, source: "indisponivel", date: null, priceCents: null };
    const flows = movements
      .filter((m) => m.movement_type === "aporte" || m.movement_type === "resgate")
      .map((m) => ({
        date: m.movement_date,
        amountCents:
          m.movement_type === "aporte" ? m.amount_cents + m.fees_cents : m.amount_cents - m.fees_cents - m.tax_cents,
        sign: (m.movement_type === "aporte" ? 1 : -1) as 1 | -1,
      }));
    return {
      valueCents: Math.max(0, accruedValueCents(flows, ctx.rate.terms, ctx.asOf, ctx.rate.series)),
      source: "indexado",
      date: ctx.asOf,
      priceCents: null,
    };
  }

  if (ctx.manual) {
    return { valueCents: ctx.manual.valueCents, source: "manual", date: ctx.manual.valueDate, priceCents: null };
  }
  return { valueCents: null, source: "indisponivel", date: null, priceCents: null };
}

export function computePosition(
  pricingMode: AssetPricingMode,
  movements: PositionMovement[],
  ctx: ValuationContext,
): AssetPosition {
  const basis = walkMovements(movements);
  const valuation = marketValueOf(pricingMode, basis, movements, ctx);

  const unrealizedPnlCents = valuation.valueCents === null ? null : valuation.valueCents - basis.investedCents;
  const totalReturnCents =
    unrealizedPnlCents === null
      ? null
      : unrealizedPnlCents + basis.realizedPnlCents + basis.incomeCents - basis.costsCents;

  return {
    quantity: basis.quantity,
    investedCents: basis.investedCents,
    averageCostCents: basis.quantity > 0 ? basis.investedCents / basis.quantity : 0,
    contributedCents: basis.contributedCents,
    withdrawnCents: basis.withdrawnCents,
    incomeCents: basis.incomeCents,
    costsCents: basis.costsCents,
    realizedPnlCents: basis.realizedPnlCents,
    marketValueCents: valuation.valueCents,
    unrealizedPnlCents,
    totalReturnCents,
    returnRate:
      totalReturnCents !== null && basis.contributedCents > 0 ? totalReturnCents / basis.contributedCents : null,
    valuationSource: valuation.source,
    valuationDate: valuation.date,
    priceCents: valuation.priceCents,
  };
}

/** Uma posição zerada e sem valor, para ativo recém-criado ainda sem movimento. */
export function emptyPosition(): AssetPosition {
  return computePosition("manual", [], { asOf: new Date().toISOString().slice(0, 10) });
}
