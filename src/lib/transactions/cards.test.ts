import { describe, expect, it } from "vitest";
import { getStatementPeriod } from "./cards";

describe("getStatementPeriod", () => {
  it("compra antes do fechamento entra na fatura do próprio mês", () => {
    // Fechamento dia 20, compra dia 10 de março -> período fev/20 -> mar/20.
    const period = getStatementPeriod(20, 10, new Date(2026, 2, 10));
    expect(period.start).toEqual(new Date(2026, 1, 21));
    expect(period.end).toEqual(new Date(2026, 2, 20));
  });

  it("compra depois do fechamento entra na fatura do mês seguinte", () => {
    const period = getStatementPeriod(20, 10, new Date(2026, 2, 25));
    expect(period.start).toEqual(new Date(2026, 2, 21));
    expect(period.end).toEqual(new Date(2026, 3, 20));
  });

  it("calcula a data de vencimento após o fechamento", () => {
    const period = getStatementPeriod(20, 27, new Date(2026, 2, 10));
    // Fechamento em 20/mar, vencimento em 27/mar (mesmo mês, pois due > closing).
    expect(period.dueDate).toEqual(new Date(2026, 2, 27));
  });

  it("calcula vencimento no mês seguinte quando o dia de vencimento é anterior ao de fechamento", () => {
    const period = getStatementPeriod(28, 5, new Date(2026, 2, 10));
    expect(period.end).toEqual(new Date(2026, 2, 28));
    expect(period.dueDate).toEqual(new Date(2026, 3, 5));
  });

  it("lida com meses mais curtos que o dia de fechamento configurado (ex.: dia 31 em abril)", () => {
    const period = getStatementPeriod(31, 5, new Date(2026, 3, 15));
    expect(period.end.getDate()).toBe(30);
  });
});
