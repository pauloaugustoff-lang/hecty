import { describe, expect, it } from "vitest";
import { buildTransferPair } from "./transfers";

function idSequence() {
  let n = 0;
  return () => `id-${++n}`;
}

describe("buildTransferPair", () => {
  it("gera duas pernas ligadas, saída na origem e entrada no destino", () => {
    const [out, inn] = buildTransferPair({
      spaceId: "space-1",
      fromAccountId: "acc-corrente",
      toAccountId: "acc-poupanca",
      amountCents: 50_000,
      movementDate: "2026-03-05",
      description: "Transferência para reserva",
      newId: idSequence(),
    });

    expect(out.direction).toBe("saida");
    expect(out.account_id).toBe("acc-corrente");
    expect(inn.direction).toBe("entrada");
    expect(inn.account_id).toBe("acc-poupanca");

    expect(out.amount_cents).toBe(50_000);
    expect(inn.amount_cents).toBe(50_000);
  });

  it("liga as duas pernas uma à outra", () => {
    const [out, inn] = buildTransferPair({
      spaceId: "space-1",
      fromAccountId: "acc-1",
      toAccountId: "acc-2",
      amountCents: 1_000,
      movementDate: "2026-03-05",
      description: "Transferência",
      newId: idSequence(),
    });

    expect(out.linked_transaction_id).toBe(inn.id);
    expect(inn.linked_transaction_id).toBe(out.id);
  });

  it("classifica ambas as pernas como transferência entre contas próprias, nunca receita/despesa", () => {
    const [out, inn] = buildTransferPair({
      spaceId: "space-1",
      fromAccountId: "acc-1",
      toAccountId: "acc-2",
      amountCents: 1_000,
      movementDate: "2026-03-05",
      description: "Transferência",
      newId: idSequence(),
    });

    expect(out.nature).toBe("transferencia_entre_contas");
    expect(inn.nature).toBe("transferencia_entre_contas");
  });

  it("rejeita transferência para a mesma conta", () => {
    expect(() =>
      buildTransferPair({
        spaceId: "space-1",
        fromAccountId: "acc-1",
        toAccountId: "acc-1",
        amountCents: 1_000,
        movementDate: "2026-03-05",
        description: "Transferência",
        newId: idSequence(),
      }),
    ).toThrow();
  });

  it("rejeita valor zero ou negativo", () => {
    expect(() =>
      buildTransferPair({
        spaceId: "space-1",
        fromAccountId: "acc-1",
        toAccountId: "acc-2",
        amountCents: 0,
        movementDate: "2026-03-05",
        description: "Transferência",
        newId: idSequence(),
      }),
    ).toThrow();
  });
});
