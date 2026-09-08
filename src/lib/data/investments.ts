import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import type {
  InvestmentAssetRow,
  InvestmentIndex,
  InvestmentMovementRow,
  TransactionNature,
} from "@/lib/supabase/types";
import { computePosition, type AssetPosition } from "@/lib/investments/position";
import { resolveQuoteSymbol } from "@/lib/investments/symbols";
import type { RateSeries } from "@/lib/investments/fixed-income";
import { loadLatestQuotes, loadRateSeries, today, type CachedQuote } from "./market-data";

export type { InvestmentAssetRow, InvestmentMovementRow };

export interface AssetWithPosition {
  asset: InvestmentAssetRow;
  position: AssetPosition;
  movementCount: number;
  /** Símbolo consultado no provedor; null para quem não é precificado por cotação. */
  quoteSymbol: string | null;
}

export interface CurrencyTotals {
  currency: string;
  marketValueCents: number;
  investedCents: number;
  incomeCents: number;
  realizedPnlCents: number;
  unrealizedPnlCents: number;
  contributedCents: number;
  /** Quantos ativos daquela moeda estão sem preço — o total abaixo os ignora. */
  unpricedAssets: number;
}

export interface Portfolio {
  assets: AssetWithPosition[];
  totals: CurrencyTotals[];
  /** Símbolos sem nenhum preço em cache — a tela oferece atualizar. */
  missingQuotes: string[];
  /** Data do preço mais antigo em uso, para avisar que a carteira está defasada. */
  oldestQuoteDate: string | null;
}

export async function listAssets(
  spaceId: string,
  options?: { includeArchived?: boolean },
): Promise<InvestmentAssetRow[]> {
  const supabase = await createClient();
  let query = supabase.from("investment_assets").select("*").eq("space_id", spaceId).order("name");
  if (!options?.includeArchived) query = query.eq("is_archived", false);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getAsset(spaceId: string, assetId: string): Promise<InvestmentAssetRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investment_assets")
    .select("*")
    .eq("space_id", spaceId)
    .eq("id", assetId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listMovements(spaceId: string, assetId?: string): Promise<InvestmentMovementRow[]> {
  const supabase = await createClient();
  return fetchAllRows<InvestmentMovementRow>((from, to) => {
    let query = supabase.from("investment_movements").select("*").eq("space_id", spaceId);
    if (assetId) query = query.eq("asset_id", assetId);
    return query.order("movement_date", { ascending: false }).order("id").range(from, to);
  });
}

/** Data a partir da qual as séries de índice precisam existir para este espaço. */
function earliestRelevantDate(assets: InvestmentAssetRow[], movements: InvestmentMovementRow[]): string {
  const candidates: string[] = [];
  for (const asset of assets) {
    if (asset.pricing_mode !== "indexado") continue;
    if (asset.issue_date) candidates.push(asset.issue_date);
  }
  const indexedAssetIds = new Set(assets.filter((a) => a.pricing_mode === "indexado").map((a) => a.id));
  for (const movement of movements) {
    if (indexedAssetIds.has(movement.asset_id)) candidates.push(movement.movement_date);
  }

  if (candidates.length === 0) {
    // Sem renda fixa cadastrada ainda: cinco anos cobrem o primeiro aporte
    // que vier sem precisar buscar a série inteira desde os anos 1980.
    const fallback = new Date();
    fallback.setUTCFullYear(fallback.getUTCFullYear() - 5);
    return fallback.toISOString().slice(0, 10);
  }
  return candidates.reduce((min, date) => (date < min ? date : min));
}

/** Índices efetivamente usados pelos ativos do espaço. */
export function indexesInUse(assets: InvestmentAssetRow[]): InvestmentIndex[] {
  const indexes = new Set<InvestmentIndex>();
  for (const asset of assets) {
    if (asset.pricing_mode === "indexado" && asset.rate_index) indexes.add(asset.rate_index);
  }
  return Array.from(indexes);
}

export async function coverageStartDate(spaceId: string): Promise<string> {
  const [assets, movements] = await Promise.all([listAssets(spaceId, { includeArchived: true }), listMovements(spaceId)]);
  return earliestRelevantDate(assets, movements);
}

/** Símbolos de cotação de todos os ativos do espaço, sem repetição. */
export async function quoteSymbolsForSpace(spaceId: string): Promise<string[]> {
  const assets = await listAssets(spaceId, { includeArchived: true });
  const symbols = new Set<string>();
  for (const asset of assets) {
    if (asset.pricing_mode !== "cotacao") continue;
    const symbol = resolveQuoteSymbol(asset);
    if (symbol) symbols.add(symbol);
  }
  return Array.from(symbols);
}

function positionFor(
  asset: InvestmentAssetRow,
  movements: InvestmentMovementRow[],
  quote: CachedQuote | undefined,
  series: Map<InvestmentIndex, RateSeries>,
  asOf: string,
): AssetPosition {
  return computePosition(asset.pricing_mode, movements, {
    asOf,
    quote: quote ? { closeCents: quote.closeCents, quoteDate: quote.quoteDate } : null,
    rate:
      asset.pricing_mode === "indexado" && asset.rate_index && series.has(asset.rate_index)
        ? {
            terms: {
              index: asset.rate_index,
              percentOfIndex: asset.rate_percent === null ? null : Number(asset.rate_percent),
              spreadAnnual: asset.rate_spread === null ? null : Number(asset.rate_spread),
            },
            series: series.get(asset.rate_index)!,
          }
        : null,
    manual:
      asset.manual_value_cents === null
        ? null
        : { valueCents: asset.manual_value_cents, valueDate: asset.manual_value_date },
  });
}

export async function loadPortfolio(spaceId: string, options?: { includeArchived?: boolean }): Promise<Portfolio> {
  const [assets, movements] = await Promise.all([listAssets(spaceId, options), listMovements(spaceId)]);

  const symbolByAsset = new Map<string, string | null>();
  const symbols: string[] = [];
  for (const asset of assets) {
    const symbol = asset.pricing_mode === "cotacao" ? resolveQuoteSymbol(asset) : null;
    symbolByAsset.set(asset.id, symbol);
    if (symbol) symbols.push(symbol);
  }

  const [quotes, series] = await Promise.all([
    loadLatestQuotes(symbols),
    loadRateSeries(indexesInUse(assets), earliestRelevantDate(assets, movements)),
  ]);

  const asOf = today();
  const movementsByAsset = new Map<string, InvestmentMovementRow[]>();
  for (const movement of movements) {
    const list = movementsByAsset.get(movement.asset_id);
    if (list) list.push(movement);
    else movementsByAsset.set(movement.asset_id, [movement]);
  }

  const withPositions: AssetWithPosition[] = assets.map((asset) => {
    const assetMovements = movementsByAsset.get(asset.id) ?? [];
    const symbol = symbolByAsset.get(asset.id) ?? null;
    return {
      asset,
      quoteSymbol: symbol,
      movementCount: assetMovements.length,
      position: positionFor(asset, assetMovements, symbol ? quotes.get(symbol) : undefined, series, asOf),
    };
  });

  const totalsByCurrency = new Map<string, CurrencyTotals>();
  const missingQuotes = new Set<string>();
  let oldestQuoteDate: string | null = null;

  for (const entry of withPositions) {
    const currency = entry.asset.currency;
    const totals =
      totalsByCurrency.get(currency) ??
      {
        currency,
        marketValueCents: 0,
        investedCents: 0,
        incomeCents: 0,
        realizedPnlCents: 0,
        unrealizedPnlCents: 0,
        contributedCents: 0,
        unpricedAssets: 0,
      };

    totals.investedCents += entry.position.investedCents;
    totals.incomeCents += entry.position.incomeCents;
    totals.realizedPnlCents += entry.position.realizedPnlCents;
    totals.contributedCents += entry.position.contributedCents;

    if (entry.position.marketValueCents === null) {
      // Ativo sem preço não entra no total: um patrimônio que soma só metade
      // da carteira e não avisa é pior do que um número faltando.
      totals.unpricedAssets += 1;
      if (entry.quoteSymbol) missingQuotes.add(entry.quoteSymbol);
    } else {
      totals.marketValueCents += entry.position.marketValueCents;
      totals.unrealizedPnlCents += entry.position.unrealizedPnlCents ?? 0;
    }

    if (entry.position.valuationSource === "cotacao" && entry.position.valuationDate) {
      if (!oldestQuoteDate || entry.position.valuationDate < oldestQuoteDate) {
        oldestQuoteDate = entry.position.valuationDate;
      }
    }

    totalsByCurrency.set(currency, totals);
  }

  return {
    assets: withPositions,
    totals: Array.from(totalsByCurrency.values()).sort((a, b) => b.marketValueCents - a.marketValueCents),
    missingQuotes: Array.from(missingQuotes),
    oldestQuoteDate,
  };
}

/** Naturezas de lançamento que descrevem um movimento de investimento. */
export const INVESTMENT_NATURES: TransactionNature[] = [
  "aplicacao_financeira",
  "resgate_investimento",
  "resgate_a_decompor",
  "rendimento_investimento",
];

export interface UnlinkedInvestmentTransaction {
  id: string;
  movement_date: string;
  original_description: string;
  normalized_description: string;
  amount_cents: number;
  direction: "entrada" | "saida";
  nature: TransactionNature;
  account_id: string | null;
}

/**
 * Lançamentos de investimento que ainda não viraram movimento de carteira.
 * É a ponte entre as duas abas: o extrato já sabe que saiu dinheiro para
 * aplicar, mas ninguém disse em QUÊ — e é isso que falta para a posição
 * existir.
 */
export async function listUnlinkedInvestmentTransactions(
  spaceId: string,
  limit = 50,
): Promise<UnlinkedInvestmentTransaction[]> {
  const supabase = await createClient();

  const { data: linked, error: linkedError } = await supabase
    .from("investment_movements")
    .select("transaction_id")
    .eq("space_id", spaceId)
    .not("transaction_id", "is", null);
  if (linkedError) throw linkedError;

  const linkedIds = new Set((linked ?? []).map((row) => row.transaction_id).filter(Boolean) as string[]);

  const { data, error } = await supabase
    .from("transactions")
    .select("id, movement_date, original_description, normalized_description, amount_cents, direction, nature, account_id")
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .in("nature", INVESTMENT_NATURES)
    .order("movement_date", { ascending: false })
    .limit(limit + linkedIds.size);
  if (error) throw error;

  return ((data ?? []) as UnlinkedInvestmentTransaction[]).filter((t) => !linkedIds.has(t.id)).slice(0, limit);
}
