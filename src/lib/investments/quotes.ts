import "server-only";

/**
 * Cotações via endpoint público de gráfico do Yahoo Finance. Ele cobre com um
 * símbolo só tudo o que a carteira precisa — B3 (PETR4.SA, MXRF11.SA), bolsas
 * americanas (VOO, AAPL), BDRs e cripto (BTC-USD) — e não pede chave.
 *
 * Em compensação é uma API não documentada: pode mudar de formato ou barrar o
 * pedido sem aviso. Por isso nada aqui lança para cima — símbolo que falha
 * volta na lista `failed`, a tela mostra quais foram, e o ativo continua
 * podendo receber preço na mão. A carteira nunca fica refém do Yahoo estar no ar.
 */

const HOSTS = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];

// O Yahoo devolve 429 para o user agent padrão do fetch do Node.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const TIMEOUT_MS = 12_000;
const CONCURRENCY = 6;

export interface FetchedQuote {
  symbol: string;
  /** Preço na menor unidade da moeda de cotação. */
  closeCents: number;
  currency: string;
  quoteDate: string;
}

interface YahooChartResponse {
  chart?: {
    result?: {
      meta?: {
        currency?: string;
        symbol?: string;
        regularMarketPrice?: number;
        regularMarketTime?: number;
      };
    }[];
    error?: { description?: string } | null;
  };
}

async function requestChart(host: string, symbol: string): Promise<YahooChartResponse | null> {
  const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as YahooChartResponse;
  } catch {
    return null;
  }
}

async function fetchOne(symbol: string): Promise<FetchedQuote | null> {
  for (const host of HOSTS) {
    const payload = await requestChart(host, symbol);
    const meta = payload?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) continue;

    // regularMarketTime é o instante do último negócio; a data do pregão é o
    // que interessa, e no fuso do próprio mercado. UTC erra em no máximo um
    // dia e só fora do horário de pregão — aceitável para um preço de fechamento.
    const quoteDate = meta?.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    return {
      symbol,
      closeCents: Math.round(price * 100),
      currency: (meta?.currency ?? "BRL").toUpperCase(),
      quoteDate,
    };
  }
  return null;
}

export async function fetchQuotes(symbols: string[]): Promise<{ quotes: FetchedQuote[]; failed: string[] }> {
  const unique = Array.from(new Set(symbols.filter(Boolean)));
  const quotes: FetchedQuote[] = [];
  const failed: string[] = [];

  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const batch = unique.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((symbol) => fetchOne(symbol)));
    results.forEach((quote, index) => {
      if (quote) quotes.push(quote);
      else failed.push(batch[index]);
    });
  }

  return { quotes, failed };
}
