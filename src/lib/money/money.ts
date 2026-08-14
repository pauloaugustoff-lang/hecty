/**
 * Toda quantia monetária no sistema é representada em centavos como
 * número inteiro (nunca ponto flutuante). Estas funções são o único
 * lugar autorizado a converter entre centavos e reais.
 */

export type Cents = number;

/** Moedas com conta cadastrável hoje. Conversão automática entre elas ainda não existe. */
export const CURRENCIES = ["BRL", "USD", "EUR"] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

export const CURRENCY_LABELS: Record<CurrencyCode, string> = {
  BRL: "Real (R$)",
  USD: "Dólar (US$)",
  EUR: "Euro (€)",
};

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string, signed: boolean): Intl.NumberFormat {
  const key = `${currency}:${signed}`;
  let formatter = formatterCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      signDisplay: signed ? "always" : "auto",
    });
    formatterCache.set(key, formatter);
  }
  return formatter;
}

/** Formata centavos numa moeda qualquer (padrão BRL, pra não quebrar chamadores existentes). */
export function formatCents(cents: Cents, currency: string = "BRL", options?: { signed?: boolean }): string {
  return getFormatter(currency, Boolean(options?.signed)).format(cents / 100);
}

export function formatCentsToBRL(cents: Cents, options?: { signed?: boolean }): string {
  return formatCents(cents, "BRL", options);
}

/**
 * Converte um valor digitado pelo usuário (ex.: "1.234,56" ou "1234.56")
 * em centavos inteiros. Lança erro se o texto não for um número válido.
 */
export function parseBRLToCents(input: string): Cents {
  const trimmed = input.trim();
  if (trimmed === "") {
    throw new Error("Valor vazio.");
  }

  let normalized = trimmed.replace(/[^\d,.-]/g, "");

  if (!/\d/.test(normalized)) {
    throw new Error(`Valor monetário inválido: "${input}"`);
  }

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    // Formato brasileiro: ponto é separador de milhar, vírgula é decimal.
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    normalized = normalized.replace(",", ".");
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    throw new Error(`Valor monetário inválido: "${input}"`);
  }

  return Math.round(value * 100);
}

/** Valor com sinal: entradas positivas, saídas negativas. */
export function signedCents(amountCents: Cents, direction: "entrada" | "saida"): Cents {
  return direction === "saida" ? -Math.abs(amountCents) : Math.abs(amountCents);
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((total, value) => total + value, 0);
}
