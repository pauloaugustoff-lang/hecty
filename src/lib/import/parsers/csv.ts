import Papa from "papaparse";

export interface ParsedTable {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(content: string): ParsedTable {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    delimiter: "", // auto-detect
    transformHeader: (h) => h.trim(),
  });

  const headers = result.meta.fields ?? [];
  const rows = result.data.filter((row) => Object.values(row).some((v) => v && v.trim() !== ""));

  return { headers, rows };
}
