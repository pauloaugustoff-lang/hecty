import "server-only";
import type { InvestmentIndex } from "@/lib/supabase/types";

/**
 * Séries de índice pelo SGS do Banco Central — API pública, sem chave, com o
 * dado oficial. Cada índice tem um código de série e uma periodicidade própria:
 *
 *   12  CDI                 taxa do dia, só em dia útil
 *   11  Selic               taxa do dia, só em dia útil
 *   433 IPCA                variação do mês, datada no dia 1º
 *   195 Poupança            rendimento do mês por data de aniversário
 *
 * 'prefixado' não tem série: a taxa está no próprio papel.
 *
 * A poupança vem com uma linha por dia do mês (o rendimento muda conforme o
 * aniversário do depósito). Guardamos só a linha do dia 1º, tratando o papel
 * como se rendesse pelo aniversário no início do mês — diferença de centavos
 * que não justifica carregar 30x mais linhas.
 */

const SERIES_CODES: Partial<Record<InvestmentIndex, number>> = {
  cdi: 12,
  selic: 11,
  ipca: 433,
  poupanca: 195,
};

/** Índices cuja taxa publicada é diária (e cuja série serve de calendário de dias úteis). */
export const DAILY_INDEXES: InvestmentIndex[] = ["cdi", "selic"];

const TIMEOUT_MS = 20_000;
/** O SGS recusa intervalos muito longos; 10 anos por requisição é o limite seguro. */
const MAX_YEARS_PER_REQUEST = 10;

export interface FetchedIndexRate {
  indexCode: InvestmentIndex;
  referenceDate: string;
  ratePercent: number;
}

interface SgsRow {
  data?: string;
  valor?: string;
}

function toIsoDate(brDate: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(brDate);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function toBrDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/** Quebra [from, to] em janelas de no máximo 10 anos. */
function dateWindows(from: string, to: string): [string, string][] {
  const windows: [string, string][] = [];
  let start = from;
  while (start <= to) {
    const startYear = Number(start.slice(0, 4));
    const candidateEnd = `${startYear + MAX_YEARS_PER_REQUEST}-${start.slice(5)}`;
    const end = candidateEnd < to ? candidateEnd : to;
    windows.push([start, end]);
    if (end === to) break;
    const next = new Date(`${end}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    start = next.toISOString().slice(0, 10);
  }
  return windows;
}

async function fetchSeriesWindow(code: number, from: string, to: string): Promise<SgsRow[]> {
  const url =
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${code}/dados` +
    `?formato=json&dataInicial=${toBrDate(from)}&dataFinal=${toBrDate(to)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`SGS ${code} respondeu ${response.status}`);
  const payload = (await response.json()) as SgsRow[];
  return Array.isArray(payload) ? payload : [];
}

export async function fetchIndexRates(
  indexCode: InvestmentIndex,
  from: string,
  to: string,
): Promise<FetchedIndexRate[]> {
  const code = SERIES_CODES[indexCode];
  if (!code) return [];

  const rows: SgsRow[] = [];
  for (const [start, end] of dateWindows(from, to)) {
    rows.push(...(await fetchSeriesWindow(code, start, end)));
  }

  const rates: FetchedIndexRate[] = [];
  for (const row of rows) {
    const referenceDate = row.data ? toIsoDate(row.data) : null;
    const ratePercent = row.valor === undefined ? NaN : Number(row.valor);
    if (!referenceDate || !Number.isFinite(ratePercent)) continue;
    // Poupança: uma linha por aniversário; ficamos com a do dia 1º.
    if (indexCode === "poupanca" && !referenceDate.endsWith("-01")) continue;
    rates.push({ indexCode, referenceDate, ratePercent });
  }
  return rates;
}
