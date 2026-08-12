import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { parseXlsx } from "./xlsx";

async function buildWorkbookBuffer(rows: (string | number | null)[][]): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Fatura");
  for (const row of rows) {
    sheet.addRow(row);
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

describe("parseXlsx", () => {
  it("não quebra quando a primeira coluna do cabeçalho está em branco", async () => {
    // Reproduz faturas de cartão reais que exportam com uma coluna A vazia
    // antes dos cabeçalhos de verdade — isso deixava um buraco no início do
    // array de headers, e o find() usado depois em suggestMapping quebrava
    // com TypeError ao tentar ler .norm de um item ausente.
    const buffer = await buildWorkbookBuffer([
      [null, "Data", "Lançamento", "Valor"],
      [null, "2026-07-08", "SUPERMERCADO", 150],
    ]);

    const table = await parseXlsx(buffer);

    expect(table.headers).toContain("Data");
    expect(table.headers).toContain("Lançamento");
    expect(table.headers).toContain("Valor");
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]["Lançamento"]).toBe("SUPERMERCADO");
  });

  it("continua funcionando normalmente sem colunas em branco", async () => {
    const buffer = await buildWorkbookBuffer([
      ["Data", "Descrição", "Valor"],
      ["2026-07-08", "COMPRA", -50],
    ]);

    const table = await parseXlsx(buffer);

    expect(table.headers).toEqual(["Data", "Descrição", "Valor"]);
    expect(table.rows).toHaveLength(1);
  });
});
