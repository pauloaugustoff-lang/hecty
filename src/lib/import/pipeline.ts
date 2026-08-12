import { normalizeDescription, extractInstallment } from "./normalize";
import { parseBRLToCents } from "@/lib/money/money";
import type { ParsedTable } from "./parsers/csv";
import type { OfxTransaction } from "./parsers/ofx";

export interface ColumnMapping {
  date: string;
  description: string;
  amount: string;
  direction?: string;
  externalId?: string;
}

const DATE_HEADER_HINTS = ["data", "date", "dt_lancamento", "data lancamento", "data lançamento"];
const DESCRIPTION_HEADER_HINTS = ["descricao", "descrição", "description", "historico", "histórico", "memo", "detalhe", "lancamento", "lançamento"];
const AMOUNT_HEADER_HINTS = ["valor", "amount", "vlr", "value"];
const DIRECTION_HEADER_HINTS = ["tipo", "type", "direcao", "direção", "d/c", "natureza"];
// "tipo"/"type" só valem como cabeçalho EXATO ("Tipo"), nunca por substring:
// senão "Tipo do cartão" (Físico/Virtual, comum em faturas de cartão) seria
// confundido com uma coluna de direção D/C.
const DIRECTION_PARTIAL_HINTS = ["direcao", "direção", "d/c", "natureza"];
const EXTERNAL_ID_HEADER_HINTS = ["id", "identificador", "fitid", "documento", "num_doc"];

function findHeaderMatch(headers: string[], hints: string[], partialHints: string[] = hints): string | undefined {
  // Defensivo contra buracos em arrays esparsos: find()/findIndex() não pulam
  // índices ausentes como forEach/map/filter pulam, então visitariam um
  // "undefined" e quebrariam ao acessar .norm nele.
  const normalized = headers.filter((h): h is string => Boolean(h)).map((h) => ({ raw: h, norm: normalizeDescription(h) }));
  for (const hint of hints) {
    const hintNorm = normalizeDescription(hint);
    const exact = normalized.find((h) => h.norm === hintNorm);
    if (exact) return exact.raw;
  }
  for (const hint of partialHints) {
    const hintNorm = normalizeDescription(hint);
    const partial = normalized.find((h) => h.norm.includes(hintNorm));
    if (partial) return partial.raw;
  }
  return undefined;
}

export function suggestMapping(headers: string[]): Partial<ColumnMapping> {
  return {
    date: findHeaderMatch(headers, DATE_HEADER_HINTS),
    description: findHeaderMatch(headers, DESCRIPTION_HEADER_HINTS),
    amount: findHeaderMatch(headers, AMOUNT_HEADER_HINTS),
    direction: findHeaderMatch(headers, DIRECTION_HEADER_HINTS, DIRECTION_PARTIAL_HINTS),
    externalId: findHeaderMatch(headers, EXTERNAL_ID_HEADER_HINTS),
  };
}

/** Aceita DD/MM/AAAA, DD-MM-AAAA, AAAA-MM-DD e variações de 2 dígitos no ano. */
export function parseFlexibleDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  const brMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, "0");
    const month = brMatch[2].padStart(2, "0");
    let year = brMatch[3];
    if (year.length === 2) year = `20${year}`;
    if (Number(month) > 12) return null;
    return `${year}-${month}-${day}`;
  }

  return null;
}

export interface NormalizedCandidate {
  rowIndex: number;
  movementDate: string | null;
  originalDescription: string;
  normalizedDescription: string;
  amountCents: number | null;
  direction: "entrada" | "saida" | null;
  externalId: string | null;
  installment: { number: number; total: number } | null;
  error: string | null;
}

function amountToCandidateFields(
  amountRaw: string,
  directionRaw: string | undefined,
  isCardImport: boolean,
): { amountCents: number | null; direction: "entrada" | "saida" | null } {
  let cents: number;
  try {
    cents = parseBRLToCents(amountRaw);
  } catch {
    return { amountCents: null, direction: null };
  }

  if (directionRaw) {
    const normalizedDirection = normalizeDescription(directionRaw);
    const isDebit = /^(D|DEBITO|DEBIT|SAIDA|S)$/.test(normalizedDirection);
    const isCredit = /^(C|CREDITO|CREDIT|ENTRADA|E)$/.test(normalizedDirection);
    if (isDebit) return { amountCents: Math.abs(cents), direction: "saida" };
    if (isCredit) return { amountCents: Math.abs(cents), direction: "entrada" };
  }

  // Fatura de cartão: a esmagadora maioria dos arquivos lista compras como
  // valores positivos sem sinal (não é um extrato com débitos e créditos
  // misturados) — por isso o padrão aqui é saída, com estorno/crédito só
  // quando o arquivo realmente traz o valor negativo.
  if (isCardImport) {
    return { amountCents: Math.abs(cents), direction: cents < 0 ? "entrada" : "saida" };
  }

  return { amountCents: Math.abs(cents), direction: cents < 0 ? "saida" : "entrada" };
}

export function normalizeTableRows(table: ParsedTable, mapping: ColumnMapping, isCardImport = false): NormalizedCandidate[] {
  return table.rows.map((row, index) => {
    const dateRaw = row[mapping.date] ?? "";
    const descriptionRaw = row[mapping.description] ?? "";
    const amountRaw = row[mapping.amount] ?? "";
    const directionRaw = mapping.direction ? row[mapping.direction] : undefined;
    const externalId = mapping.externalId ? row[mapping.externalId]?.trim() || null : null;

    const movementDate = parseFlexibleDate(dateRaw);
    const { amountCents, direction } = amountToCandidateFields(amountRaw, directionRaw, isCardImport);
    const installment = extractInstallment(descriptionRaw);

    let error: string | null = null;
    if (!movementDate) error = "Data inválida";
    else if (amountCents === null || amountCents === 0) error = "Valor inválido";
    else if (!descriptionRaw.trim()) error = "Descrição vazia";

    return {
      rowIndex: index,
      movementDate,
      originalDescription: descriptionRaw.trim(),
      normalizedDescription: normalizeDescription(descriptionRaw),
      amountCents,
      direction,
      externalId,
      installment,
      error,
    };
  });
}

export function normalizeOfxRows(transactions: OfxTransaction[]): NormalizedCandidate[] {
  return transactions.map((tx, index) => {
    const description = tx.memo || tx.name || "";
    const installment = extractInstallment(description);

    let error: string | null = null;
    if (!tx.datePosted) error = "Data inválida";
    else if (tx.amount === null || tx.amount === 0) error = "Valor inválido";
    else if (!description.trim()) error = "Descrição vazia";

    return {
      rowIndex: index,
      movementDate: tx.datePosted,
      originalDescription: description.trim(),
      normalizedDescription: normalizeDescription(description),
      amountCents: tx.amount !== null ? Math.round(Math.abs(tx.amount) * 100) : null,
      direction: tx.amount !== null ? (tx.amount < 0 ? "saida" : "entrada") : null,
      externalId: tx.fitId,
      installment,
      error,
    };
  });
}
