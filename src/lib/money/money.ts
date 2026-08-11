/**
 * Toda quantia monetária no sistema é representada em centavos como
 * número inteiro (nunca ponto flutuante). Estas funções são o único
 * lugar autorizado a converter entre centavos e reais.
 */

export type Cents = number;

const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const BRL_FORMATTER_SIGNED = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  signDisplay: "always",
});

export function formatCentsToBRL(cents: Cents, options?: { signed?: boolean }): string {
  const reais = cents / 100;
  return options?.signed ? BRL_FORMATTER_SIGNED.format(reais) : BRL_FORMATTER.format(reais);
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
