export interface OfxTransaction {
  type: string | null;
  datePosted: string | null; // yyyy-MM-dd
  amount: number | null; // reais, com sinal
  fitId: string | null;
  name: string | null;
  memo: string | null;
}

function extractTag(block: string, tag: string): string | null {
  const match = block.match(new RegExp(`<${tag}>([^<\\r\\n]*)`, "i"));
  return match ? match[1].trim() : null;
}

function parseOfxDate(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.slice(0, 8);
  if (digits.length !== 8) return null;
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  return `${year}-${month}-${day}`;
}

/**
 * OFX (1.x/SGML ou 2.x/XML) — extrai as transações de dentro dos blocos
 * <STMTTRN>...</STMTTRN> sem exigir um parser XML completo, já que muitos
 * bancos exportam OFX 1.x com tags não fechadas.
 */
export function parseOfx(content: string): OfxTransaction[] {
  const blocks = content.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi) ?? [];

  return blocks.map((block) => {
    const amountRaw = extractTag(block, "TRNAMT");
    return {
      type: extractTag(block, "TRNTYPE"),
      datePosted: parseOfxDate(extractTag(block, "DTPOSTED")),
      amount: amountRaw ? Number(amountRaw.replace(",", ".")) : null,
      fitId: extractTag(block, "FITID"),
      name: extractTag(block, "NAME"),
      memo: extractTag(block, "MEMO"),
    };
  });
}
