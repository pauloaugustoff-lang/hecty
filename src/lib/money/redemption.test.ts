import { describe, expect, it } from "vitest";
import { analyzeRedemption, redemptionNature } from "./redemption";

describe("analyzeRedemption", () => {
  it("separa principal e rendimento líquido quando decomposto (exemplo do produto)", () => {
    // Resgate de R$ 105.000: R$ 100.000 de principal + R$ 5.000 de rendimento líquido.
    const result = analyzeRedemption({
      totalAmountCents: 105_000_00,
      principalCents: 100_000_00,
      netYieldCents: 5_000_00,
    });

    expect(result.isDecomposed).toBe(true);
    expect(result.netYieldCents).toBe(5_000_00);
    expect(result.principalReturnedCents).toBe(100_000_00);
    expect(result.pendingAmountCents).toBe(0);
    expect(result.discrepancyCents).toBe(0);
  });

  it("nunca trata o valor total do resgate como receita", () => {
    const result = analyzeRedemption({
      totalAmountCents: 105_000_00,
      principalCents: 100_000_00,
      netYieldCents: 5_000_00,
    });

    expect(result.netYieldCents).toBe(5_000_00);
    expect(result.netYieldCents).toBeLessThan(105_000_00);
  });

  it("deriva o rendimento líquido a partir de bruto, imposto e taxas", () => {
    const result = analyzeRedemption({
      totalAmountCents: 105_000_00,
      principalCents: 100_000_00,
      grossYieldCents: 6_000_00,
      taxCents: 900_00,
      feesCents: 100_00,
    });

    expect(result.netYieldCents).toBe(5_000_00);
    expect(result.discrepancyCents).toBe(0);
  });

  it("mantém como pendente (resgate a decompor) quando só o total é conhecido", () => {
    const result = analyzeRedemption({ totalAmountCents: 105_000_00 });

    expect(result.isDecomposed).toBe(false);
    expect(result.netYieldCents).toBe(0);
    expect(result.principalReturnedCents).toBe(0);
    expect(result.pendingAmountCents).toBe(105_000_00);
  });

  it("mantém pendente se só o principal é conhecido, sem o rendimento", () => {
    const result = analyzeRedemption({
      totalAmountCents: 105_000_00,
      principalCents: 100_000_00,
    });

    expect(result.isDecomposed).toBe(false);
    expect(result.pendingAmountCents).toBe(105_000_00);
  });

  it("acusa discrepância quando os componentes não fecham com o total", () => {
    const result = analyzeRedemption({
      totalAmountCents: 105_000_00,
      principalCents: 100_000_00,
      netYieldCents: 4_000_00,
    });

    expect(result.discrepancyCents).toBe(1_000_00);
  });
});

describe("redemptionNature", () => {
  it("classifica como resgate a decompor sem principal e rendimento", () => {
    expect(redemptionNature({})).toBe("resgate_a_decompor");
  });

  it("classifica como resgate de investimento quando decomposto", () => {
    expect(redemptionNature({ principalCents: 100_000_00, netYieldCents: 5_000_00 })).toBe("resgate_investimento");
  });

  it("aceita rendimento bruto no lugar do líquido para considerar decomposto", () => {
    expect(redemptionNature({ principalCents: 100_000_00, grossYieldCents: 6_000_00 })).toBe("resgate_investimento");
  });
});
