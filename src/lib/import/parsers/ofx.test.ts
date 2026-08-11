import { describe, expect, it } from "vitest";
import { parseOfx } from "./ofx";

const SAMPLE_OFX_1X = `
OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260305120000[-3:GMT]
<TRNAMT>-150.00
<FITID>202603050001
<NAME>SUPERMERCADOS BH
<MEMO>COMPRA CARTAO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260310120000[-3:GMT]
<TRNAMT>5000.00
<FITID>202603100002
<NAME>SALARIO EMPRESA XYZ
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`;

describe("parseOfx", () => {
  it("extrai transações de um OFX 1.x (SGML, tags não fechadas)", () => {
    const result = parseOfx(SAMPLE_OFX_1X);
    expect(result).toHaveLength(2);
  });

  it("converte a data para yyyy-MM-dd", () => {
    const [first] = parseOfx(SAMPLE_OFX_1X);
    expect(first.datePosted).toBe("2026-03-05");
  });

  it("preserva o sinal do valor (negativo para débito)", () => {
    const [first, second] = parseOfx(SAMPLE_OFX_1X);
    expect(first.amount).toBe(-150);
    expect(second.amount).toBe(5000);
  });

  it("extrai FITID para deduplicação pelo identificador do banco", () => {
    const [first] = parseOfx(SAMPLE_OFX_1X);
    expect(first.fitId).toBe("202603050001");
  });

  it("extrai nome e memo", () => {
    const [first] = parseOfx(SAMPLE_OFX_1X);
    expect(first.name).toBe("SUPERMERCADOS BH");
    expect(first.memo).toBe("COMPRA CARTAO");
  });

  it("retorna lista vazia quando não há transações", () => {
    expect(parseOfx("<OFX></OFX>")).toEqual([]);
  });
});
