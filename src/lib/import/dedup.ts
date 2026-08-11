import { normalizeDescription } from "./normalize";
import type { TransactionDirection } from "@/lib/supabase/types";

export interface DedupInput {
  spaceId: string;
  accountId?: string | null;
  cardId?: string | null;
  movementDate: string;
  amountCents: number;
  direction: TransactionDirection;
  description: string;
}

/**
 * Hash determinístico e portátil (sem dependência de Node `crypto`, para
 * poder rodar tanto no navegador durante o assistente de importação
 * quanto no servidor). Não é criptográfico — serve apenas para agrupar
 * candidatos a duplicidade; a decisão final é sempre do usuário.
 */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function computeDedupHash(input: DedupInput): string {
  const key = [
    input.spaceId,
    input.accountId ?? "",
    input.cardId ?? "",
    input.movementDate,
    input.amountCents,
    input.direction,
    normalizeDescription(input.description),
  ].join("|");

  return fnv1a(key);
}

export interface ExistingTransactionRef {
  id: string;
  dedupHash: string;
  importExternalId?: string | null;
}

export interface DuplicateCheckResult {
  isPotentialDuplicate: boolean;
  matchedTransactionId: string | null;
  reason: "external_id" | "hash" | null;
}

/**
 * Compara uma linha candidata contra as transações já existentes no
 * espaço. Nunca descarta silenciosamente: apenas sinaliza para revisão.
 */
export function checkDuplicate(
  candidate: { dedupHash: string; externalId?: string | null },
  existing: ExistingTransactionRef[],
): DuplicateCheckResult {
  if (candidate.externalId) {
    const byExternalId = existing.find((tx) => tx.importExternalId === candidate.externalId);
    if (byExternalId) {
      return { isPotentialDuplicate: true, matchedTransactionId: byExternalId.id, reason: "external_id" };
    }
  }

  const byHash = existing.find((tx) => tx.dedupHash === candidate.dedupHash);
  if (byHash) {
    return { isPotentialDuplicate: true, matchedTransactionId: byHash.id, reason: "hash" };
  }

  return { isPotentialDuplicate: false, matchedTransactionId: null, reason: null };
}
