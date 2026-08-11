"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeDescription } from "@/lib/import/normalize";
import type { TransactionNature } from "@/lib/supabase/types";

export interface BulkClassifyInput {
  transactionIds: string[];
  nature: TransactionNature;
  categoryId: string | null;
  subcategoryId: string | null;
  counterparty: string | null;
  createRule: boolean;
  ruleMatchValue: string | null;
}

export interface BulkActionState {
  error?: string;
  success?: boolean;
  updatedCount?: number;
}

export async function bulkClassifyAction(spaceId: string, userId: string, input: BulkClassifyInput): Promise<BulkActionState> {
  if (input.transactionIds.length === 0) {
    return { error: "Selecione ao menos um lançamento." };
  }

  const supabase = await createClient();

  const { error, count } = await supabase
    .from("transactions")
    .update(
      {
        nature: input.nature,
        category_id: input.categoryId,
        subcategory_id: input.subcategoryId,
        classification_status: "classificado" as const,
        ...(input.counterparty ? { counterparty: input.counterparty } : {}),
      },
      { count: "exact" },
    )
    .in("id", input.transactionIds)
    .eq("space_id", spaceId)
    .select("id");

  if (error) {
    return { error: "Não foi possível classificar os lançamentos selecionados." };
  }

  if (input.createRule && input.ruleMatchValue) {
    await supabase.from("rules").insert({
      space_id: spaceId,
      name: `Auto: ${input.ruleMatchValue}`,
      match_type: "contem",
      match_values: [normalizeDescription(input.ruleMatchValue)],
      action_nature: input.nature,
      action_category_id: input.categoryId,
      action_subcategory_id: input.subcategoryId,
      action_counterparty: input.counterparty || null,
      created_by: userId,
    });
  }

  revalidatePath("/revisar");
  revalidatePath("/transacoes");
  revalidatePath("/visao-geral");
  revalidatePath("/regras");
  return { success: true, updatedCount: count ?? input.transactionIds.length };
}

export interface MarkTransferInput {
  transactionAId: string;
  transactionBId: string;
}

export async function markAsTransferAction(spaceId: string, input: MarkTransferInput): Promise<BulkActionState> {
  const supabase = await createClient();

  const { data: rows, error: fetchError } = await supabase
    .from("transactions")
    .select("id, account_id, direction, amount_cents")
    .in("id", [input.transactionAId, input.transactionBId])
    .eq("space_id", spaceId);

  if (fetchError || !rows || rows.length !== 2) {
    return { error: "Não foi possível localizar os dois lançamentos." };
  }

  const [a, b] = rows;
  const sameAmount = a.amount_cents === b.amount_cents;
  const oppositeDirection = a.direction !== b.direction;
  const differentAccounts = a.account_id && b.account_id && a.account_id !== b.account_id;

  if (!sameAmount || !oppositeDirection || !differentAccounts) {
    return { error: "Os dois lançamentos precisam ser de contas diferentes, mesmo valor e direções opostas." };
  }

  const { error: updateErrorA } = await supabase
    .from("transactions")
    .update({ nature: "transferencia_entre_contas", classification_status: "classificado", linked_transaction_id: b.id })
    .eq("id", a.id);
  const { error: updateErrorB } = await supabase
    .from("transactions")
    .update({ nature: "transferencia_entre_contas", classification_status: "classificado", linked_transaction_id: a.id })
    .eq("id", b.id);

  if (updateErrorA || updateErrorB) {
    return { error: "Não foi possível vincular os lançamentos." };
  }

  revalidatePath("/revisar");
  revalidatePath("/transacoes");
  revalidatePath("/visao-geral");
  return { success: true, updatedCount: 2 };
}

export interface DecomposeRedemptionInput {
  transactionId: string;
  principalCents: number;
  netYieldCents: number;
  institution: string;
  product: string;
}

export async function decomposeRedemptionAction(spaceId: string, input: DecomposeRedemptionInput): Promise<BulkActionState> {
  const supabase = await createClient();

  const { data: tx } = await supabase
    .from("transactions")
    .select("amount_cents")
    .eq("id", input.transactionId)
    .eq("space_id", spaceId)
    .maybeSingle();

  if (!tx) return { error: "Lançamento não encontrado." };

  await supabase.from("redemption_details").upsert({
    transaction_id: input.transactionId,
    space_id: spaceId,
    total_amount_cents: tx.amount_cents,
    principal_cents: input.principalCents,
    net_yield_cents: input.netYieldCents,
    institution: input.institution,
    product: input.product,
  });

  await supabase
    .from("transactions")
    .update({ nature: "resgate_investimento", classification_status: "classificado" })
    .eq("id", input.transactionId);

  revalidatePath("/revisar");
  revalidatePath("/visao-geral");
  return { success: true, updatedCount: 1 };
}

export async function applyRulesToUnclassifiedAction(spaceId: string): Promise<BulkActionState> {
  const supabase = await createClient();

  const [{ data: rules }, { data: transactions }] = await Promise.all([
    supabase.from("rules").select("*").eq("space_id", spaceId).eq("is_active", true).order("priority"),
    supabase
      .from("transactions")
      .select("id, original_description, amount_cents, direction, account_id, card_id")
      .eq("space_id", spaceId)
      .is("deleted_at", null)
      .neq("classification_status", "classificado"),
  ]);

  if (!rules?.length || !transactions?.length) {
    return { success: true, updatedCount: 0 };
  }

  const { findMatchingRule, actionFromRule } = await import("@/lib/rules/engine");
  const { toRuleDefinition } = await import("@/lib/data/rules");

  const ruleDefs = rules.map(toRuleDefinition);
  let updated = 0;

  for (const tx of transactions) {
    const match = findMatchingRule(ruleDefs, {
      description: tx.original_description,
      amountCents: tx.amount_cents,
      direction: tx.direction,
      accountId: tx.account_id,
      cardId: tx.card_id,
    });

    if (!match) continue;
    const action = actionFromRule(match);

    await supabase
      .from("transactions")
      .update({
        nature: action.markTransfer ? "transferencia_entre_contas" : action.nature,
        category_id: action.categoryId ?? null,
        subcategory_id: action.subcategoryId ?? null,
        counterparty: action.counterparty ?? undefined,
        classification_status: "classificado",
        classified_by_rule_id: match.id,
      })
      .eq("id", tx.id);

    updated += 1;
  }

  if (updated > 0) {
    revalidatePath("/revisar");
    revalidatePath("/transacoes");
    revalidatePath("/visao-geral");
  }

  return { success: true, updatedCount: updated };
}
