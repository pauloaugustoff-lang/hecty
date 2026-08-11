import { describe, expect, it } from "vitest";
import { computeDashboardMetrics, type DashboardTransactionInput } from "./dashboard-metrics";

function tx(overrides: Partial<DashboardTransactionInput>): DashboardTransactionInput {
  return {
    amountCents: 0,
    direction: "saida",
    nature: "despesa",
    classificationStatus: "classificado",
    ...overrides,
  };
}

describe("computeDashboardMetrics", () => {
  it("um resgate de R$ 105.000 só gera R$ 5.000 de receita efetiva", () => {
    const metrics = computeDashboardMetrics([
      tx({
        amountCents: 105_000_00,
        direction: "entrada",
        nature: "resgate_investimento",
        redemption: {
          isDecomposed: true,
          netYieldCents: 5_000_00,
          principalReturnedCents: 100_000_00,
          pendingAmountCents: 0,
        },
      }),
    ]);

    expect(metrics.entradasCaixaCents).toBe(105_000_00);
    expect(metrics.receitasEfetivasCents).toBe(5_000_00);
    expect(metrics.rendimentosLiquidosCents).toBe(5_000_00);
    expect(metrics.resgatesPrincipalCents).toBe(100_000_00);
  });

  it("resgate a decompor não vira receita nem retorno de capital ainda", () => {
    const metrics = computeDashboardMetrics([
      tx({
        amountCents: 105_000_00,
        direction: "entrada",
        nature: "resgate_a_decompor",
      }),
    ]);

    expect(metrics.entradasCaixaCents).toBe(105_000_00);
    expect(metrics.receitasEfetivasCents).toBe(0);
    expect(metrics.resgatesPrincipalCents).toBe(0);
    expect(metrics.resgatesPendentesDecomposicao).toBe(1);
    expect(metrics.temDadosIncompletos).toBe(true);
  });

  it("transferência entre contas não afeta receita nem despesa", () => {
    const metrics = computeDashboardMetrics([
      tx({ amountCents: 50_000_00, direction: "saida", nature: "transferencia_entre_contas" }),
      tx({ amountCents: 50_000_00, direction: "entrada", nature: "transferencia_entre_contas" }),
    ]);

    expect(metrics.receitasEfetivasCents).toBe(0);
    expect(metrics.despesasCents).toBe(0);
    expect(metrics.entradasCaixaCents).toBe(50_000_00);
    expect(metrics.saidasCaixaCents).toBe(50_000_00);
  });

  it("pagamento de fatura de cartão não duplica a despesa das compras", () => {
    const metrics = computeDashboardMetrics([
      tx({ amountCents: 20_000, direction: "saida", nature: "despesa" }), // compra no cartão
      tx({ amountCents: 20_000, direction: "saida", nature: "pagamento_cartao" }), // pagamento da fatura
    ]);

    expect(metrics.despesasCents).toBe(20_000);
  });

  it("resultado econômico é receita efetiva menos despesa", () => {
    const metrics = computeDashboardMetrics([
      tx({ amountCents: 800_000, direction: "entrada", nature: "receita_trabalho" }),
      tx({ amountCents: 300_000, direction: "saida", nature: "despesa" }),
    ]);

    expect(metrics.resultadoEconomicoCents).toBe(500_000);
  });

  it("percentual de despesas cobertas por rendimentos", () => {
    const metrics = computeDashboardMetrics([
      tx({ amountCents: 200_000, direction: "saida", nature: "despesa" }),
      tx({
        amountCents: 210_000,
        direction: "entrada",
        nature: "resgate_investimento",
        redemption: { isDecomposed: true, netYieldCents: 100_000, principalReturnedCents: 110_000, pendingAmountCents: 0 },
      }),
    ]);

    expect(metrics.percentualDespesasCobertasPorRendimentos).toBe(0.5);
  });

  it("retorna null para o percentual quando não há despesas", () => {
    const metrics = computeDashboardMetrics([]);
    expect(metrics.percentualDespesasCobertasPorRendimentos).toBeNull();
  });

  it("conta lançamentos não classificados", () => {
    const metrics = computeDashboardMetrics([
      tx({ classificationStatus: "nao_classificado" }),
      tx({ classificationStatus: "classificado" }),
      tx({ classificationStatus: "revisao_pendente" }),
    ]);

    expect(metrics.transacoesPendentesClassificacao).toBe(2);
    expect(metrics.temDadosIncompletos).toBe(true);
  });

  it("capital consumido é o resgate de principal líquido de novas aplicações, nunca negativo", () => {
    const metrics = computeDashboardMetrics([
      tx({
        amountCents: 100_000,
        direction: "entrada",
        nature: "resgate_investimento",
        redemption: { isDecomposed: true, netYieldCents: 0, principalReturnedCents: 100_000, pendingAmountCents: 0 },
      }),
      tx({ amountCents: 150_000, direction: "saida", nature: "aplicacao_financeira" }),
    ]);

    expect(metrics.capitalConsumidoCents).toBe(0);
  });
});
