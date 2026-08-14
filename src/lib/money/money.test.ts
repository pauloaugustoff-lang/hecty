import { describe, expect, it } from "vitest";
import { formatCents, formatCentsToBRL, parseBRLToCents, signedCents, sumCents } from "./money";

const NBSP = " ";

describe("formatCentsToBRL", () => {
  it("formata centavos como reais", () => {
    expect(formatCentsToBRL(10500)).toBe(`R$${NBSP}105,00`);
    expect(formatCentsToBRL(0)).toBe(`R$${NBSP}0,00`);
    expect(formatCentsToBRL(-500)).toBe(`-R$${NBSP}5,00`);
  });

  it("aceita exibir o sinal explicitamente", () => {
    expect(formatCentsToBRL(500, { signed: true })).toBe(`+R$${NBSP}5,00`);
  });
});

describe("formatCents", () => {
  it("formata em BRL por padrão", () => {
    expect(formatCents(10500)).toBe(formatCentsToBRL(10500));
  });

  it("formata em outras moedas quando informado", () => {
    expect(formatCents(10500, "USD")).toContain("105,00");
    expect(formatCents(10500, "USD")).not.toBe(formatCentsToBRL(10500));
  });
});

describe("parseBRLToCents", () => {
  it("interpreta formato brasileiro com milhar e decimal", () => {
    expect(parseBRLToCents("1.234,56")).toBe(123456);
  });

  it("interpreta apenas vírgula decimal", () => {
    expect(parseBRLToCents("105,00")).toBe(10500);
  });

  it("interpreta ponto decimal simples", () => {
    expect(parseBRLToCents("105.5")).toBe(10550);
  });

  it("ignora o símbolo de moeda e espaços", () => {
    expect(parseBRLToCents("R$ 1.500,00")).toBe(150000);
  });

  it("rejeita texto vazio ou inválido", () => {
    expect(() => parseBRLToCents("")).toThrow();
    expect(() => parseBRLToCents("abc")).toThrow();
  });
});

describe("signedCents", () => {
  it("mantém entradas positivas e torna saídas negativas", () => {
    expect(signedCents(1000, "entrada")).toBe(1000);
    expect(signedCents(1000, "saida")).toBe(-1000);
  });
});

describe("sumCents", () => {
  it("soma uma lista de valores com sinal", () => {
    expect(sumCents([1000, -300, 200])).toBe(900);
    expect(sumCents([])).toBe(0);
  });
});
