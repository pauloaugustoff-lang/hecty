import type { InvestmentIndex } from "@/lib/supabase/types";

/**
 * Correção de renda fixa por índice. O que entra aqui são as séries públicas
 * do Banco Central (SGS), guardadas em index_rates exatamente como publicadas:
 *
 *   cdi / selic  taxa DIÁRIA em %, só em dias úteis (SGS 12 e 11)
 *   ipca         variação MENSAL em %, datada no dia 1º (SGS 433)
 *   poupanca     rendimento MENSAL em %, aqui só o do dia 1º (SGS 195)
 *
 * Duas aproximações assumidas e visíveis na tela como "estimativa":
 *
 * 1. Índices mensais entram por mês fechado. Não há pró-rata dentro do mês
 *    nem projeção do mês corrente — um CDB IPCA+ aportado no dia 20 rende,
 *    aqui, a partir do mês seguinte.
 * 2. O IPCA é publicado com cerca de um mês e meio de atraso, então o valor
 *    de um IPCA+ fica sempre defasado em relação à marcação da corretora.
 *
 * O CDI, que é a maior parte da renda fixa brasileira, não sofre nenhuma das
 * duas: é diário e sai no dia seguinte.
 */

export interface RateTerms {
  index: InvestmentIndex;
  /** % do índice — 110 para "110% do CDI". Nulo quando a remuneração é índice + spread. */
  percentOfIndex: number | null;
  /** Spread anual somado ao índice. Em 'prefixado', é a própria taxa anual. */
  spreadAnnual: number | null;
}

export interface RateSeries {
  /** Data ISO (yyyy-mm-dd) -> taxa do dia em %. Vazio para índices mensais. */
  daily: Map<string, number>;
  /** Competência (yyyy-mm) -> variação do mês em %. Vazio para índices diários. */
  monthly: Map<string, number>;
  /**
   * Calendário de dias úteis em ordem crescente, usado tanto para o CDI/Selic
   * quanto para elevar taxas anuais a du/252. Vem da própria série do CDI, que
   * só tem dia útil — é o feriado bancário oficial de graça, sem manter uma
   * tabela de feriados no código.
   */
  businessDays: string[];
}

export function emptyRateSeries(): RateSeries {
  return { daily: new Map(), monthly: new Map(), businessDays: [] };
}

const DAYS_PER_YEAR = 252;

/** Dias úteis em (from, to] segundo o calendário do CDI. */
export function businessDaysBetween(series: RateSeries, from: string, to: string): number {
  let count = 0;
  for (const day of series.businessDays) {
    if (day > from && day <= to) count += 1;
    else if (day > to) break;
  }
  return count;
}

function annualToFactor(annualPercent: number, businessDays: number): number {
  if (businessDays <= 0) return 1;
  return (1 + annualPercent / 100) ** (businessDays / DAYS_PER_YEAR);
}

function dailyIndexFactor(series: RateSeries, from: string, to: string, percentOfIndex: number | null): number {
  const multiplier = percentOfIndex === null ? 1 : percentOfIndex / 100;
  let factor = 1;
  for (const [day, rate] of series.daily) {
    if (day > from && day <= to) factor *= 1 + (rate / 100) * multiplier;
  }
  return factor;
}

function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/**
 * Meses fechados em (mês de `from`, mês de `to`]. O mês do aporte fica de fora
 * porque o dinheiro não passou por ele inteiro; o mês do cálculo entra se já
 * tiver sido publicado (na prática ainda não terá, pelo atraso do IPCA).
 */
function monthlyIndexFactor(series: RateSeries, from: string, to: string, percentOfIndex: number | null): number {
  const multiplier = percentOfIndex === null ? 1 : percentOfIndex / 100;
  const firstMonth = monthKey(from);
  const lastMonth = monthKey(to);
  let factor = 1;
  for (const [month, rate] of series.monthly) {
    if (month > firstMonth && month <= lastMonth) factor *= 1 + (rate / 100) * multiplier;
  }
  return factor;
}

/**
 * Fator de correção acumulado entre duas datas (exclusivo na inicial,
 * inclusivo na final). 1 significa "não rendeu nada"; 1,12 significa +12%.
 */
export function accrualFactor(terms: RateTerms, from: string, to: string, series: RateSeries): number {
  if (to <= from) return 1;

  const du = businessDaysBetween(series, from, to);
  const spreadFactor = terms.spreadAnnual ? annualToFactor(terms.spreadAnnual, du) : 1;

  switch (terms.index) {
    case "prefixado":
      // O spread É a taxa: sem índice para acumular por cima.
      return spreadFactor;
    case "cdi":
    case "selic":
      return dailyIndexFactor(series, from, to, terms.percentOfIndex) * spreadFactor;
    case "ipca":
    case "poupanca":
      return monthlyIndexFactor(series, from, to, terms.percentOfIndex) * spreadFactor;
    default:
      return spreadFactor;
  }
}

/**
 * Quanto vale hoje um conjunto de entradas e saídas de um papel indexado.
 *
 * Cada movimento é corrigido da sua própria data até `asOf` e somado com o
 * sinal do fluxo. Isso é exatamente o comportamento de uma conta que rende:
 * o que entrou rende desde que entrou, o que saiu deixa de render a partir do
 * resgate — sem precisar rastrear lote por lote.
 */
export function accruedValueCents(
  flows: { date: string; amountCents: number; sign: 1 | -1 }[],
  terms: RateTerms,
  asOf: string,
  series: RateSeries,
): number {
  let total = 0;
  for (const flow of flows) {
    if (flow.date > asOf) continue;
    total += flow.sign * flow.amountCents * accrualFactor(terms, flow.date, asOf, series);
  }
  return Math.round(total);
}
