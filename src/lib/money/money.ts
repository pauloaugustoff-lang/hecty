/**
 * Toda quantia monetária no sistema é representada em centavos como
 * número inteiro (nunca ponto flutuante). Estas funções são o único
 * lugar autorizado a converter entre centavos e reais.
 */

export type Cents = number;

/** Moedas com conta cadastrável hoje. Conversão automática entre elas ainda não existe. */
export const CURRENCIES = ["BRL", "USD", "EUR", "BTC"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  BRL: "Real (R$)",
  USD: "Dólar (US$)",
  EUR: "Euro (€)",
  BTC: "Bitcoin (BTC)",
};

/**
 * Casas decimais da menor unidade de cada moeda. "Centavos" no sistema
 * significa a menor unidade da moeda da conta: centavos de real/dólar/euro
 * (2 casas) ou satoshis (8 casas) — 0,00000001 BTC não caberia em 2 casas.
 * Moeda fora do mapa assume 2.
 */
const CURRENCY_DECIMALS: Record<string, number> = { BTC: 8 };

export function currencyDecimals(currency: string): number {
  return CURRENCY_DECIMALS[currency] ?? 2;
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, signed: boolean): Intl.NumberFormat {
  const key = `${currency}:${signed}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    const decimals = currencyDecimals(currency);
    formatter = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      signDisplay: signed ? "always" : "auto",
      // Moedas de 8 casas (BTC) mostram só as casas necessárias, sem uma
      // cauda fixa de zeros; as de 2 casas mantêm o padrão da moeda.
      ...(decimals !== 2 ? { minimumFractionDigits: 2, maximumFractionDigits: decimals } : {}),
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/** Formata a menor unidade da moeda (centavos/satoshis) como valor legível. */
export function formatCents(cents: Cents, currency: string = "BRL", options?: { signed?: boolean }): string {
  return getFormatter(currency, Boolean(options?.signed)).format(cents / 10 ** currencyDecimals(currency));
}

export function formatCentsToBRL(cents: Cents, options?: { signed?: boolean }): string {
  return formatCents(cents, "BRL", options);
}

/**
 * Interpreta um número digitado pelo usuário em formato brasileiro ou
 * americano (ex.: "1.234,56" ou "1234.56") e devolve o valor decimal puro.
 * Lança erro se o texto não for um número válido.
 */
export function parseDecimalPtBR(input: string): number {
  const trimmed = input.trim();
  if (trimmed === "") {
    throw new Error("Valor vazio.");
  }

  let normalized = trimmed.replace(/[^\d,.-]/g, "");

  if (!/\d/.test(normalized)) {
    throw new Error(`Valor inválido: "${input}"`);
  }

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    // Formato brasileiro: ponto é separador de milhar, vírgula é decimal.
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  } else if (hasDot && /^-?\d{1,3}(\.\d{3})+$/.test(normalized)) {
    // Só pontos e todos agrupando de 3 em 3 ("1.500", "1.500.000"): é o
    // separador de milhar pt-BR sem casa decimal, não um decimal — senão
    // "1.500" (mil e quinhentos) viraria R$ 1,50.
    normalized = normalized.replace(/\./g, "");
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error(`Valor inválido: "${input}"`);
  }

  return value;
}

/**
 * Converte um valor digitado pelo usuário na menor unidade inteira da moeda
 * (centavos para 2 casas, satoshis para BTC). Lança erro se inválido.
 */
export function parseToCents(input: string, currency: string = "BRL"): Cents {
  return Math.round(parseDecimalPtBR(input) * 10 ** currencyDecimals(currency));
}

/**
 * Converte um valor digitado pelo usuário (ex.: "1.234,56" ou "1234.56")
 * em centavos inteiros. Lança erro se o texto não for um número válido.
 */
export function parseBRLToCents(input: string): Cents {
  return parseToCents(input, "BRL");
}

/** Valor com sinal: entradas positivas, saídas negativas. */
export function signedCents(amountCents: Cents, direction: "entrada" | "saida"): Cents {
  return direction === "saida" ? -Math.abs(amountCents) : Math.abs(amountCents);
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}
