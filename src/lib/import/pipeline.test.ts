import { describe, expect, it } from "vitest";
import { suggestMapping, parseFlexibleDate, normalizeTableRows, normalizeOfxRows } from "./pipeline";
import type { ParsedTable } from "./parsers/csv";

describe("suggestMapping", () => {
  it("reconhece cabeçalhos comuns em português", () => {
    const mapping = suggestMapping(["Data", "Histórico", "Valor", "Tipo"]);
    expect(mapping.date).toBe("Data");
    expect(mapping.description).toBe("Histórico");
    expect(mapping.amount).toBe("Valor");
    expect(mapping.direction).toBe("Tipo");
  });

  it("reconhece cabeçalhos em inglês", () => {
    const mapping = suggestMapping(["Date", "Description", "Amount"]);
    expect(mapping.date).toBe("Date");
    expect(mapping.description).toBe("Description");
    expect(mapping.amount).toBe("Amount");
  });

  it("não sugere coluna quando não há correspondência", () => {
    const mapping = suggestMapping(["Coluna A", "Coluna B"]);
    expect(mapping.date).toBeUndefined();
  });
});

describe("parseFlexibleDate", () => {
  it("aceita formato brasileiro DD/MM/AAAA", () => {
    expect(parseFlexibleDate("05/03/2026")).toBe("2026-03-05");
  });

  it("aceita ano com 2 dígitos", () => {
    expect(parseFlexibleDate("05/03/26")).toBe("2026-03-05");
  });

  it("aceita formato ISO AAAA-MM-DD", () => {
    expect(parseFlexibleDate("2026-03-05")).toBe("2026-03-05");
  });

  it("retorna null para texto vazio ou inválido", () => {
    expect(parseFlexibleDate("")).toBeNull();
    expect(parseFlexibleDate("não é uma data")).toBeNull();
  });
});

describe("normalizeTableRows", () => {
  const table: ParsedTable = {
    headers: ["Data", "Histórico", "Valor"],
    rows: [
      { Data: "05/03/2026", Histórico: "SUPERMERCADOS BH", Valor: "-150,00" },
      { Data: "10/03/2026", Histórico: "SALARIO EMPRESA", Valor: "5000,00" },
      { Data: "inválida", Histórico: "LINHA QUEBRADA", Valor: "abc" },
    ],
  };
  const mapping = { date: "Data", description: "Histórico", amount: "Valor" };

  it("converte valores negativos em saída e positivos em entrada", () => {
    const [first, second] = normalizeTableRows(table, mapping);
    expect(first.direction).toBe("saida");
    expect(first.amountCents).toBe(15000);
    expect(second.direction).toBe("entrada");
    expect(second.amountCents).toBe(500000);
  });

  it("sinaliza erro em linhas com data ou valor inválidos", () => {
    const [, , third] = normalizeTableRows(table, mapping);
    expect(third.error).not.toBeNull();
  });

  it("detecta parcelamento na descrição", () => {
    const withInstallment: ParsedTable = {
      headers: ["Data", "Histórico", "Valor"],
      rows: [{ Data: "05/03/2026", Histórico: "LOJA XYZ 2/12", Valor: "-100,00" }],
    };
    const [row] = normalizeTableRows(withInstallment, mapping);
    expect(row.installment).toEqual({ number: 2, total: 12 });
  });

  it("usa coluna de direção explícita quando fornecida (D/C)", () => {
    const withDirection: ParsedTable = {
      headers: ["Data", "Histórico", "Valor", "Tipo"],
      rows: [{ Data: "05/03/2026", Histórico: "TARIFA", Valor: "50,00", Tipo: "D" }],
    };
    const [row] = normalizeTableRows(withDirection, { ...mapping, direction: "Tipo" });
    expect(row.direction).toBe("saida");
    expect(row.amountCents).toBe(5000);
  });
});

describe("normalizeOfxRows", () => {
  it("usa o memo como descrição quando disponível, senão o nome", () => {
    const [row] = normalizeOfxRows([
      { type: "DEBIT", datePosted: "2026-03-05", amount: -50, fitId: "1", name: "LOJA", memo: "COMPRA" },
    ]);
    expect(row.originalDescription).toBe("COMPRA");
    expect(row.direction).toBe("saida");
    expect(row.amountCents).toBe(5000);
    expect(row.externalId).toBe("1");
  });
});
