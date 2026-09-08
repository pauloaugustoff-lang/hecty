import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type { AssetQuoteRow, IndexRateRow, InvestmentIndex } from "@/lib/supabase/types";
import { emptyRateSeries, type RateSeries } from "@/lib/investments/fixed-income";
import { DAILY_INDEXES, fetchIndexRates } from "@/lib/investments/indexes";
import type { FetchedQuote } from "@/lib/investments/quotes";

/**
 * Cotações e séries de índice são dado público de mercado, não dado do
 * usuário: as tabelas asset_quotes e index_rates não têm space_id e o RLS só
 * dá SELECT. A gravação passa pela service role aqui — se qualquer membro
 * pudesse escrever, um espaço conseguiria alterar o preço visto por outro.
 */

/** Janela de busca do último preço: fim de semana, feriado e papel parado cabem. */
const QUOTE_LOOKBACK_DAYS = 45;

export interface CachedQuote {
  closeCents: number;
  quoteDate: string;
  currency: string;
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Último preço conhecido de cada símbolo. */
export async function loadLatestQuotes(symbols: string[]): Promise<Map<string, CachedQuote>> {
  const latest = new Map<string, CachedQuote>();
  if (symbols.length === 0) return latest;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("asset_quotes")
    .select("symbol, quote_date, close_cents, currency")
    .in("symbol", Array.from(new Set(symbols)))
    .gte("quote_date", daysAgo(QUOTE_LOOKBACK_DAYS))
    .order("quote_date", { ascending: false });

  if (error) throw error;

  // Ordenado do mais recente para o mais antigo: a primeira linha de cada
  // símbolo já é a que vale.
  for (const row of (data ?? []) as Pick<AssetQuoteRow, "symbol" | "quote_date" | "close_cents" | "currency">[]) {
    if (latest.has(row.symbol)) continue;
    latest.set(row.symbol, {
      closeCents: row.close_cents,
      quoteDate: row.quote_date,
      currency: row.currency,
    });
  }
  return latest;
}

export async function saveQuotes(quotes: FetchedQuote[]): Promise<void> {
  if (quotes.length === 0) return;
  const admin = createAdminClient();
  const { error } = await admin.from("asset_quotes").upsert(
    quotes.map((q) => ({
      symbol: q.symbol,
      quote_date: q.quoteDate,
      close_cents: q.closeCents,
      currency: q.currency,
      source: "yahoo",
      fetched_at: new Date().toISOString(),
    })),
    { onConflict: "symbol,quote_date" },
  );
  if (error) throw error;
}

/**
 * Garante que as séries pedidas cobrem [from, hoje], buscando no Banco Central
 * só o pedaço que falta. O CDI entra sempre: além de ser o índice mais usado,
 * a série dele é o calendário de dias úteis de que o prefixado e os spreads
 * precisam.
 */
export async function ensureIndexCoverage(indexes: InvestmentIndex[], from: string): Promise<void> {
  const wanted = new Set<InvestmentIndex>(indexes.filter((i) => i !== "prefixado"));
  wanted.add("cdi");

  const admin = createAdminClient();
  const to = today();

  for (const indexCode of wanted) {
    const [{ data: firstRow }, { data: lastRow }] = await Promise.all([
      admin
        .from("index_rates")
        .select("reference_date")
        .eq("index_code", indexCode)
        .order("reference_date", { ascending: true })
        .limit(1)
        .maybeSingle(),
      admin
        .from("index_rates")
        .select("reference_date")
        .eq("index_code", indexCode)
        .order("reference_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const ranges: [string, string][] = [];
    if (!firstRow || !lastRow) {
      ranges.push([from, to]);
    } else {
      if (from < firstRow.reference_date) ranges.push([from, firstRow.reference_date]);
      if (lastRow.reference_date < to) ranges.push([lastRow.reference_date, to]);
    }

    for (const [start, end] of ranges) {
      const rates = await fetchIndexRates(indexCode, start, end);
      if (rates.length === 0) continue;
      const { error } = await admin.from("index_rates").upsert(
        rates.map((r) => ({
          index_code: r.indexCode,
          reference_date: r.referenceDate,
          rate_percent: r.ratePercent,
          fetched_at: new Date().toISOString(),
        })),
        { onConflict: "index_code,reference_date" },
      );
      if (error) throw error;
    }
  }
}

/**
 * Monta as séries prontas para o motor de renda fixa. O calendário de dias
 * úteis sai da série do CDI, que só tem pregão — feriado bancário de graça,
 * sem manter tabela de feriados no código.
 */
export async function loadRateSeries(indexes: InvestmentIndex[], from: string): Promise<Map<InvestmentIndex, RateSeries>> {
  const wanted = new Set<InvestmentIndex>(indexes);
  wanted.add("cdi");

  const supabase = await createClient();
  const rows = await fetchAllRows<Pick<IndexRateRow, "index_code" | "reference_date" | "rate_percent">>((f, t) =>
    supabase
      .from("index_rates")
      .select("index_code, reference_date, rate_percent")
      .in("index_code", Array.from(wanted))
      .gte("reference_date", from)
      .order("index_code")
      .order("reference_date")
      .range(f, t),
  );

  const businessDays: string[] = [];
  const byIndex = new Map<InvestmentIndex, RateSeries>();
  for (const indexCode of wanted) byIndex.set(indexCode, emptyRateSeries());

  for (const row of rows) {
    const series = byIndex.get(row.index_code);
    if (!series) continue;
    const rate = Number(row.rate_percent);
    if (DAILY_INDEXES.includes(row.index_code)) {
      series.daily.set(row.reference_date, rate);
      if (row.index_code === "cdi") businessDays.push(row.reference_date);
    } else {
      series.monthly.set(row.reference_date.slice(0, 7), rate);
    }
  }

  for (const series of byIndex.values()) series.businessDays = businessDays;
  // 'prefixado' não tem série própria — só precisa do calendário para a base 252.
  byIndex.set("prefixado", { daily: new Map(), monthly: new Map(), businessDays });

  return byIndex;
}
