import type { AssetClass } from "@/lib/supabase/types";

/**
 * O ticker que a pessoa digita ("PETR4") não é o símbolo que o provedor de
 * cotação entende ("PETR4.SA"). Esta função faz a tradução a partir da classe
 * do ativo, para que ninguém precise saber do sufixo.
 *
 * Se o ativo já traz quote_symbol preenchido, ele manda — é a saída para
 * papéis que não seguem a regra (uma ação canadense em .TO, um par de cripto
 * em BRL em vez de USD).
 */

/** Classes negociadas na B3, cujo símbolo no provedor leva o sufixo .SA. */
const B3_CLASSES: AssetClass[] = ["acao", "fii", "etf", "bdr"];

export function resolveQuoteSymbol(asset: {
  asset_class: AssetClass;
  ticker: string | null;
  quote_symbol: string | null;
}): string | null {
  const explicit = asset.quote_symbol?.trim().toUpperCase();
  if (explicit) return explicit;

  const ticker = asset.ticker?.trim().toUpperCase();
  if (!ticker) return null;

  // Já veio com sufixo de bolsa (PETR4.SA, SHOP.TO) ou é um par (BTC-USD).
  if (ticker.includes(".") || ticker.includes("-") || ticker.includes("=")) return ticker;

  if (B3_CLASSES.includes(asset.asset_class)) return `${ticker}.SA`;
  if (asset.asset_class === "cripto") return `${ticker}-USD`;
  return ticker;
}

/** Moeda esperada para o símbolo, usada como padrão ao cadastrar o ativo. */
export function defaultCurrencyForClass(assetClass: AssetClass): string {
  switch (assetClass) {
    case "stock":
    case "reit":
    case "cripto":
      return "USD";
    default:
      return "BRL";
  }
}
