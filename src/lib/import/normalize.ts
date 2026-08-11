const DIACRITICS_REGEX = new RegExp(
  "[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]",
  "g",
);

/** Remove acentos, colapsa espaços e caixa alta — usado para comparação e regras. */
export function normalizeDescription(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export interface InstallmentInfo {
  number: number;
  total: number;
}

const INSTALLMENT_PATTERNS = [
  /\bPARC(?:ELA)?\s*(\d{1,2})\s*\/\s*(\d{1,2})\b/,
  /\b(\d{1,2})\s*\/\s*(\d{1,2})\s*$/,
];

/** Detecta padrões como "2/12" ou "PARC 02/12" no fim/meio da descrição. */
export function extractInstallment(description: string): InstallmentInfo | null {
  const normalized = normalizeDescription(description);

  for (const pattern of INSTALLMENT_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) {
      const number = Number(match[1]);
      const total = Number(match[2]);
      if (number >= 1 && total >= number && total <= 60) {
        return { number, total };
      }
    }
  }

  return null;
}
