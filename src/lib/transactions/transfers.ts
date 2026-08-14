import type { Cents } from "@/lib/money/money";

export interface TransferLegInput {
  spaceId: string;
  fromAccountId: string;
  toAccountId: string;
  amountCents: Cents;
  /** Valor creditado na conta de destino, na moeda dela. Default: igual a amountCents (mesma moeda). */
  toAmountCents?: Cents;
  movementDate: string;
  description: string;
  /** Ex.: registro da cotação usada, quando as contas têm moedas diferentes. */
  notes?: string;
  newId: () => string;
}

export interface TransferLeg {
  id: string;
  space_id: string;
  account_id: string;
  card_id: null;
  movement_date: string;
  competence_date: string;
  original_description: string;
  normalized_description: string;
  amount_cents: number;
  direction: "entrada" | "saida";
  nature: "transferencia_entre_contas";
  origin: "manual";
  classification_status: "classificado";
  linked_transaction_id: string;
  notes: string;
}

/**
 * Uma transferência entre contas próprias nunca é receita nem despesa:
 * gera duas pernas ligadas (saída na origem, entrada no destino) com a
 * mesma natureza, para que o dashboard as exclua do resultado econômico.
 * Entre contas de moedas diferentes, cada perna tem seu próprio valor
 * (amountCents na origem, toAmountCents no destino) — não é o mesmo número
 * de centavos reinterpretado noutra moeda.
 */
export function buildTransferPair(input: TransferLegInput): [TransferLeg, TransferLeg] {
  if (input.fromAccountId === input.toAccountId) {
    throw new Error("A conta de origem e a de destino devem ser diferentes.");
  }
  if (input.amountCents <= 0) {
    throw new Error("O valor da transferência deve ser maior que zero.");
  }
  const toAmountCents = input.toAmountCents ?? input.amountCents;
  if (toAmountCents <= 0) {
    throw new Error("O valor convertido deve ser maior que zero.");
  }

  const outId = input.newId();
  const inId = input.newId();
  const normalized = input.description.trim();
  const notes = input.notes ?? "";

  const base = {
    space_id: input.spaceId,
    card_id: null,
    movement_date: input.movementDate,
    competence_date: input.movementDate,
    original_description: input.description,
    normalized_description: normalized,
    nature: "transferencia_entre_contas" as const,
    origin: "manual" as const,
    classification_status: "classificado" as const,
    notes,
  };

  const out: TransferLeg = {
    ...base,
    id: outId,
    account_id: input.fromAccountId,
    amount_cents: input.amountCents,
    direction: "saida",
    linked_transaction_id: inId,
  };

  const inn: TransferLeg = {
    ...base,
    id: inId,
    account_id: input.toAccountId,
    amount_cents: toAmountCents,
    direction: "entrada",
    linked_transaction_id: outId,
  };

  return [out, inn];
}
