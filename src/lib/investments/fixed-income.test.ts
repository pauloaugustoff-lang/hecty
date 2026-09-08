import { describe, it, expect } from "vitest";
import { accrualFactor, accruedValueCents, businessDaysBetween, type RateSeries } from "./fixed-income";

/** Cinco dias úteis de janeiro com CDI de 0,05% ao dia (a fim de semana fica de fora). */
function cdiSeries(): RateSeries {
  const days = ["2026-01-02", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08"];
  return {
    daily: new Map(days.map((d) => [d, 0.05])),
    monthly: new Map(),
    businessDays: days,
  };
}

/** Calendário de 252 dias úteis, para checar a conversão de taxa anual. */
function fullYearSeries(): RateSeries {
  const days: string[] = [];
  const cursor = new Date(Date.UTC(2026, 0, 1));
  while (days.length < 252) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { daily: new Map(), monthly: new Map(), businessDays: days };
}

describe("businessDaysBetween", () => {
  it("conta o dia final e ignora o inicial", () => {
    expect(businessDaysBetween(cdiSeries(), "2026-01-02", "2026-01-07")).toBe(3);
  });

  it("é zero quando as datas coincidem", () => {
    expect(businessDaysBetween(cdiSeries(), "2026-01-05", "2026-01-05")).toBe(0);
  });
});

describe("accrualFactor", () => {
  it("acumula o CDI dia a dia, sem contar o dia do aporte", () => {
    const terms = { index: "cdi" as const, percentOfIndex: 100, spreadAnnual: null };
    // Rende em 05, 06 e 07: 1,0005^3
    expect(accrualFactor(terms, "2026-01-02", "2026-01-07", cdiSeries())).toBeCloseTo(1.0005 ** 3, 10);
  });

  it("aplica o percentual do índice sobre a taxa diária", () => {
    const terms = { index: "cdi" as const, percentOfIndex: 110, spreadAnnual: null };
    expect(accrualFactor(terms, "2026-01-02", "2026-01-07", cdiSeries())).toBeCloseTo((1 + 0.0005 * 1.1) ** 3, 10);
  });

  it("prefixado usa a base 252 dias úteis", () => {
    const terms = { index: "prefixado" as const, percentOfIndex: null, spreadAnnual: 12 };
    const series = fullYearSeries();
    const oneYearLater = series.businessDays[251];
    expect(accrualFactor(terms, "2025-12-31", oneYearLater, series)).toBeCloseTo(1.12, 10);
  });

  it("IPCA acumula meses fechados e soma o spread anual por cima", () => {
    const series: RateSeries = {
      daily: new Map(),
      monthly: new Map([
        ["2026-01", 0.5],
        ["2026-02", 0.4],
        ["2026-03", 0.3],
      ]),
      // O spread precisa do calendário; 21 dias úteis por mês é o suficiente aqui.
      businessDays: fullYearSeries().businessDays,
    };
    const terms = { index: "ipca" as const, percentOfIndex: null, spreadAnnual: null };
    // Aporte em janeiro: só fevereiro e março contam (janeiro não foi mês cheio).
    expect(accrualFactor(terms, "2026-01-15", "2026-03-31", series)).toBeCloseTo(1.004 * 1.003, 10);
  });

  it("não rende quando a data final não é posterior à inicial", () => {
    const terms = { index: "cdi" as const, percentOfIndex: 100, spreadAnnual: null };
    expect(accrualFactor(terms, "2026-01-07", "2026-01-02", cdiSeries())).toBe(1);
  });
});

describe("accruedValueCents", () => {
  const terms = { index: "cdi" as const, percentOfIndex: 100, spreadAnnual: null };

  it("corrige o aporte da data dele até hoje", () => {
    const value = accruedValueCents(
      [{ date: "2026-01-02", amountCents: 100_000, sign: 1 }],
      terms,
      "2026-01-07",
      cdiSeries(),
    );
    expect(value).toBe(Math.round(100_000 * 1.0005 ** 3));
  });

  it("o que foi resgatado para de render a partir do resgate", () => {
    const series = cdiSeries();
    const value = accruedValueCents(
      [
        { date: "2026-01-02", amountCents: 100_000, sign: 1 },
        { date: "2026-01-06", amountCents: 40_000, sign: -1 },
      ],
      terms,
      "2026-01-08",
      series,
    );
    // O aporte rende 4 dias (05,06,07,08); o resgate desconta o que ele
    // renderia nos 2 dias restantes (07,08).
    expect(value).toBe(Math.round(100_000 * 1.0005 ** 4 - 40_000 * 1.0005 ** 2));
  });

  it("ignora movimento posterior à data de avaliação", () => {
    const value = accruedValueCents(
      [
        { date: "2026-01-02", amountCents: 100_000, sign: 1 },
        { date: "2026-01-08", amountCents: 50_000, sign: 1 },
      ],
      terms,
      "2026-01-06",
      cdiSeries(),
    );
    expect(value).toBe(Math.round(100_000 * 1.0005 ** 2));
  });
});
