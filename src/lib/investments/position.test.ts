import { describe, it, expect } from "vitest";
import { computePosition, type PositionMovement } from "./position";
import type { InvestmentMovementType } from "@/lib/supabase/types";

function mov(
  movement_type: InvestmentMovementType,
  movement_date: string,
  fields: Partial<PositionMovement> = {},
): PositionMovement {
  return {
    movement_type,
    movement_date,
    quantity: 0,
    amount_cents: 0,
    fees_cents: 0,
    tax_cents: 0,
    split_factor: null,
    ...fields,
  };
}

const quote = (closeCents: number) => ({ closeCents, quoteDate: "2026-09-08" });
const ctx = (closeCents?: number) => ({
  asOf: "2026-09-08",
  quote: closeCents === undefined ? null : quote(closeCents),
});

describe("computePosition — preço médio", () => {
  it("soma a corretagem ao custo de aquisição", () => {
    const p = computePosition(
      "cotacao",
      [mov("aporte", "2026-01-10", { quantity: 100, amount_cents: 1_000_000, fees_cents: 500 })],
      ctx(10_500),
    );
    expect(p.quantity).toBe(100);
    expect(p.investedCents).toBe(1_000_500);
    expect(p.averageCostCents).toBeCloseTo(10_005, 6);
    expect(p.marketValueCents).toBe(1_050_000);
    expect(p.unrealizedPnlCents).toBe(49_500);
  });

  it("faz a média entre dois aportes de preços diferentes", () => {
    const p = computePosition(
      "cotacao",
      [
        mov("aporte", "2026-01-10", { quantity: 100, amount_cents: 1_000_000 }),
        mov("aporte", "2026-02-10", { quantity: 100, amount_cents: 1_400_000 }),
      ],
      ctx(),
    );
    expect(p.quantity).toBe(200);
    expect(p.averageCostCents).toBe(12_000);
  });

  it("venda parcial realiza lucro sobre o preço médio, não sobre o lote antigo", () => {
    const p = computePosition(
      "cotacao",
      [
        mov("aporte", "2026-01-10", { quantity: 100, amount_cents: 1_000_000 }),
        mov("aporte", "2026-02-10", { quantity: 100, amount_cents: 1_400_000 }),
        mov("resgate", "2026-03-10", { quantity: 50, amount_cents: 750_000, fees_cents: 1_000 }),
      ],
      ctx(15_000),
    );
    // Custo médio 120,00; vendeu 50 por 7.500 menos 10 de taxa = 7.490.
    expect(p.quantity).toBe(150);
    expect(p.investedCents).toBe(1_800_000);
    expect(p.realizedPnlCents).toBe(749_000 - 600_000);
    expect(p.withdrawnCents).toBe(749_000);
  });

  it("zera o custo quando a posição inteira é vendida", () => {
    const p = computePosition(
      "cotacao",
      [
        mov("aporte", "2026-01-10", { quantity: 3, amount_cents: 100_000 }),
        mov("resgate", "2026-03-10", { quantity: 3, amount_cents: 120_000 }),
      ],
      ctx(40_000),
    );
    expect(p.quantity).toBe(0);
    expect(p.investedCents).toBe(0);
    expect(p.marketValueCents).toBe(0);
    expect(p.realizedPnlCents).toBe(20_000);
  });

  it("desdobramento multiplica a quantidade e derruba o preço médio", () => {
    const p = computePosition(
      "cotacao",
      [
        mov("aporte", "2026-01-10", { quantity: 100, amount_cents: 1_000_000 }),
        mov("desdobramento", "2026-05-02", { split_factor: 10 }),
      ],
      ctx(),
    );
    expect(p.quantity).toBe(1_000);
    expect(p.investedCents).toBe(1_000_000);
    expect(p.averageCostCents).toBe(1_000);
  });

  it("bonificação aumenta a quantidade sem aumentar o custo", () => {
    const p = computePosition(
      "cotacao",
      [
        mov("aporte", "2026-01-10", { quantity: 100, amount_cents: 1_000_000 }),
        mov("bonificacao", "2026-06-01", { quantity: 10 }),
      ],
      ctx(),
    );
    expect(p.quantity).toBe(110);
    expect(p.investedCents).toBe(1_000_000);
    expect(p.contributedCents).toBe(1_000_000);
  });

  it("provento entra líquido de imposto e não mexe no custo", () => {
    const p = computePosition(
      "cotacao",
      [
        mov("aporte", "2026-01-10", { quantity: 100, amount_cents: 1_000_000 }),
        mov("provento", "2026-04-15", { amount_cents: 20_000, tax_cents: 3_000 }),
      ],
      ctx(10_000),
    );
    expect(p.incomeCents).toBe(17_000);
    expect(p.investedCents).toBe(1_000_000);
    expect(p.totalReturnCents).toBe(17_000);
  });

  it("taxa avulsa reduz o resultado sem virar custo de aquisição", () => {
    const p = computePosition(
      "cotacao",
      [
        mov("aporte", "2026-01-10", { quantity: 100, amount_cents: 1_000_000 }),
        mov("taxa", "2026-04-15", { amount_cents: 2_500 }),
      ],
      ctx(10_000),
    );
    expect(p.investedCents).toBe(1_000_000);
    expect(p.costsCents).toBe(2_500);
    expect(p.totalReturnCents).toBe(-2_500);
  });

  it("a ordem do mesmo dia põe o desdobramento antes do resgate", () => {
    const p = computePosition(
      "cotacao",
      [
        mov("aporte", "2026-01-10", { quantity: 100, amount_cents: 1_000_000 }),
        mov("resgate", "2026-05-02", { quantity: 500, amount_cents: 500_000 }),
        mov("desdobramento", "2026-05-02", { split_factor: 10 }),
      ],
      ctx(),
    );
    expect(p.quantity).toBe(500);
  });
});

describe("computePosition — resgate sem quantidade (renda fixa e fundos)", () => {
  it("baixa o principal e realiza só o excedente", () => {
    const p = computePosition(
      "manual",
      [
        mov("aporte", "2026-01-10", { amount_cents: 1_000_000 }),
        mov("resgate", "2026-06-10", { amount_cents: 1_150_000, tax_cents: 30_000 }),
      ],
      { asOf: "2026-09-08", manual: { valueCents: 0, valueDate: "2026-09-08" } },
    );
    expect(p.investedCents).toBe(0);
    // Recebeu 11.200 líquidos, devolveu 10.000 de principal.
    expect(p.withdrawnCents).toBe(1_120_000);
    expect(p.realizedPnlCents).toBe(120_000);
  });
});

describe("computePosition — sem preço disponível", () => {
  it("não inventa valor de mercado nem rentabilidade", () => {
    const p = computePosition("cotacao", [mov("aporte", "2026-01-10", { quantity: 10, amount_cents: 100_000 })], {
      asOf: "2026-09-08",
      quote: null,
    });
    expect(p.marketValueCents).toBeNull();
    expect(p.unrealizedPnlCents).toBeNull();
    expect(p.totalReturnCents).toBeNull();
    expect(p.returnRate).toBeNull();
    expect(p.valuationSource).toBe("indisponivel");
    // O que é fato — quantidade e custo — continua disponível.
    expect(p.quantity).toBe(10);
    expect(p.investedCents).toBe(100_000);
  });
});

describe("computePosition — rentabilidade", () => {
  it("mede o retorno sobre o capital aportado", () => {
    const p = computePosition(
      "cotacao",
      [
        mov("aporte", "2026-01-10", { quantity: 100, amount_cents: 1_000_000 }),
        mov("provento", "2026-04-15", { amount_cents: 50_000 }),
      ],
      ctx(11_000),
    );
    // +1.000 de valorização e +500 de proventos sobre 10.000 aportados.
    expect(p.totalReturnCents).toBe(150_000);
    expect(p.returnRate).toBeCloseTo(0.15, 10);
  });
});
