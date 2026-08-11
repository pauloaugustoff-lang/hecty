import { describe, expect, it } from "vitest";
import { checkDuplicate, computeDedupHash } from "./dedup";

const base = {
  spaceId: "space-1",
  accountId: "acc-1",
  cardId: null,
  movementDate: "2026-03-05",
  amountCents: 15_000,
  direction: "saida" as const,
  description: "SUPERMERCADOS BH",
};

describe("computeDedupHash", () => {
  it("gera o mesmo hash para o mesmo lançamento", () => {
    expect(computeDedupHash(base)).toBe(computeDedupHash({ ...base }));
  });

  it("é insensível a variação de acentuação/caixa na descrição", () => {
    expect(computeDedupHash(base)).toBe(computeDedupHash({ ...base, description: "supermercados bh" }));
  });

  it("muda o hash se a data mudar", () => {
    expect(computeDedupHash(base)).not.toBe(computeDedupHash({ ...base, movementDate: "2026-03-06" }));
  });

  it("muda o hash se o valor mudar", () => {
    expect(computeDedupHash(base)).not.toBe(computeDedupHash({ ...base, amountCents: 15_001 }));
  });

  it("distingue lançamentos de contas diferentes com mesmo valor/data/descrição", () => {
    expect(computeDedupHash(base)).not.toBe(computeDedupHash({ ...base, accountId: "acc-2" }));
  });
});

describe("checkDuplicate", () => {
  it("sinaliza duplicidade possível quando o hash já existe", () => {
    const hash = computeDedupHash(base);
    const result = checkDuplicate(
      { dedupHash: hash },
      [{ id: "tx-1", dedupHash: hash }],
    );

    expect(result.isPotentialDuplicate).toBe(true);
    expect(result.matchedTransactionId).toBe("tx-1");
    expect(result.reason).toBe("hash");
  });

  it("prioriza o identificador do banco quando disponível", () => {
    const result = checkDuplicate(
      { dedupHash: "hash-novo", externalId: "banco-123" },
      [{ id: "tx-1", dedupHash: "hash-diferente", importExternalId: "banco-123" }],
    );

    expect(result.isPotentialDuplicate).toBe(true);
    expect(result.reason).toBe("external_id");
  });

  it("não sinaliza duplicidade quando não há nenhuma correspondência", () => {
    const result = checkDuplicate({ dedupHash: "hash-unico" }, [{ id: "tx-1", dedupHash: "outro-hash" }]);
    expect(result.isPotentialDuplicate).toBe(false);
    expect(result.matchedTransactionId).toBeNull();
  });

  it("nunca descarta silenciosamente: apenas sinaliza para revisão", () => {
    const hash = computeDedupHash(base);
    const result = checkDuplicate({ dedupHash: hash }, [{ id: "tx-1", dedupHash: hash }]);
    // O chamador decide o que fazer; a função nunca remove a linha sozinha.
    expect(result).toHaveProperty("matchedTransactionId");
  });
});
