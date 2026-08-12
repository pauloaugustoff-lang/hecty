import ExcelJS from "exceljs";
import type { ParsedTable } from "./csv";

export async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedTable> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  // includeEmpty é necessário aqui: planilhas com uma coluna A em branco antes
  // dos cabeçalhos de verdade (comum em faturas de cartão exportadas) fariam
  // essa coluna nunca ser visitada com includeEmpty:false, deixando um buraco
  // no início do array — e Array.prototype.find (usado depois em
  // findHeaderMatch) não pula buracos como forEach/map, então quebrava com
  // um TypeError ao tentar ler .norm de um item inexistente.
  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = String(cell.value ?? `Coluna ${colNumber}`).trim() || `Coluna ${colNumber}`;
  });

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    let hasValue = false;
    headers.forEach((header, idx) => {
      const cell = row.getCell(idx + 1);
      const value = cellToString(cell.value);
      record[header] = value;
      if (value.trim() !== "") hasValue = true;
    });
    if (hasValue) rows.push(record);
  });

  return { headers, rows };
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "result" in value) return String(value.result ?? "");
  if (typeof value === "object" && "text" in value) return String(value.text ?? "");
  return String(value);
}
