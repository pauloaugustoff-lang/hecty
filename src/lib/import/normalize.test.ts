import { describe, expect, it } from "vitest";
import { extractInstallment, normalizeDescription } from "./normalize";

describe("normalizeDescription", () => {
  it("remove acentos e coloca em caixa alta", () => {
    expect(normalizeDescription("Supermercados BH")).toBe("SUPERMERCADOS BH");
    expect(normalizeDescription("Pagamento Condomínio")).toBe("PAGAMENTO CONDOMINIO");
  });

  it("colapsa espaços repetidos e remove espaços nas pontas", () => {
    expect(normalizeDescription("  Uber   *Trip   Help.uber.com  ")).toBe("UBER *TRIP HELP.UBER.COM");
  });
});

describe("extractInstallment", () => {
  it("detecta parcelamento no formato N/N no fim da descrição", () => {
    expect(extractInstallment("COMPRA LOJA XYZ 2/12")).toEqual({ number: 2, total: 12 });
  });

  it("detecta parcelamento com prefixo PARC", () => {
    expect(extractInstallment("PARC 03/10 LOJA ABC")).toEqual({ number: 3, total: 10 });
  });

  it("retorna null quando não há parcelamento", () => {
    expect(extractInstallment("SUPERMERCADOS BH LTDA")).toBeNull();
  });

  it("ignora números que não formam um padrão válido de parcela", () => {
    expect(extractInstallment("COMPRA 99/1")).toBeNull();
  });
});
