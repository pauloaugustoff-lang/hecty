"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeDescription } from "@/lib/import/normalize";
import { fetchAllRows, chunk } from "@/lib/supabase/fetch-all";
import { classificationStatusFor } from "@/lib/domain/classification";
import { revalidateTransactionData } from "@/lib/revalidate-financial";
import type { TransactionNature } from "@/lib/supabase/types";

export interface BulkClassifyInput {
  transactionIds: string[];
  nature: TransactionNature;
  categoryId: string | null;
  subcategoryId: string | null;
  counterparty: string | null;
  /** Em branco/null = não alterar. Preenchido = aplica a todos. */
  notes?: string | null;
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
        // Regra compartilhada, não "classificado" fixo: natureza "resgate a
        // decompor" (ou despesa sem categoria) precisa CONTINUAR na fila de
        // revisão — o valor fixo tirava esses lançamentos da fila pra sempre.
        classification_status: classificationStatusFor(input.nature, Boolean(input.categoryId)),
        ...(input.counterparty ? { counterparty: input.counterparty } : {}),
        ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
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

  revalidateTransactionData();
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

  revalidateTransactionData();
  return { success: true, updatedCount: 2 };
}

export interface MarkCardPaymentInput {
  transactionIds: string[];
  cardId: string;
}

export async function markAsCardPaymentAction(spaceId: string, input: MarkCardPaymentInput): Promise<BulkActionState> {
  if (input.transactionIds.length === 0) return { error: "Selecione ao menos um lançamento." };

  const supabase = await createClient();

  const { data: txs, error: fetchError } = await supabase
    .from("transactions")
    .select("id, account_id, direction")
    .in("id", input.transactionIds)
    .eq("space_id", spaceId);

  if (fetchError || !txs || txs.length !== input.transactionIds.length) {
    return { error: "Não foi possível localizar os lançamentos selecionados." };
  }

  if (txs.some((tx) => !tx.account_id || tx.direction !== "saida")) {
    return { error: "Pagamento de fatura precisa ser uma saída de uma conta (não de outro cartão)." };
  }

  const accountIds = new Set(txs.map((tx) => tx.account_id));
  if (accountIds.size > 1) {
    return { error: "Selecione lançamentos da mesma conta — cada pagamento de fatura sai de uma única conta." };
  }

  const { error, count } = await supabase
    .from("transactions")
    .update(
      {
        nature: "pagamento_cartao",
        paid_card_id: input.cardId,
        category_id: null,
        subcategory_id: null,
        classification_status: "classificado",
      },
      { count: "exact" },
    )
    .in("id", input.transactionIds)
    .eq("space_id", spaceId);

  if (error) {
    return { error: "Não foi possível marcar como pagamento de fatura." };
  }

  revalidateTransactionData();
  return { success: true, updatedCount: count ?? input.transactionIds.length };
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

  revalidateTransactionData();
  return { success: true, updatedCount: 1 };
}

export async function applyRulesToUnclassifiedAction(spaceId: string): Promise<BulkActionState> {
  const supabase = await createClient();

  const [{ data: rules }, transactions] = await Promise.all([
    supabase.from("rules").select("*").eq("space_id", spaceId).eq("is_active", true).order("priority"),
    // Paginado: sem isto a varredura parava em 1000 lançamentos (max_rows do
    // PostgREST) e reportava sucesso, deixando o resto sem classificar.
    fetchAllRows<{
      id: string;
      original_description: string;
      amount_cents: number;
      direction: "entrada" | "saida";
      account_id: string | null;
      card_id: string | null;
    }>((pageFrom, pageTo) =>
      supabase
        .from("transactions")
        .select("id, original_description, amount_cents, direction, account_id, card_id")
        .eq("space_id", spaceId)
        .is("deleted_at", null)
        .neq("classification_status", "classificado")
        .order("id")
        .range(pageFrom, pageTo),
    ),
  ]);

  if (!rules?.length || !transactions.length) {
    return { success: true, updatedCount: 0 };
  }

  const { findMatchingRule, actionFromRule } = await import("@/lib/rules/engine");
  const { toRuleDefinition } = await import("@/lib/data/rules");

  const ruleDefs = rules.map(toRuleDefinition);

  // Todos os lançamentos casados pela mesma regra recebem a mesma ação, então
  // agrupa por regra e faz um UPDATE em lote por grupo — antes era um UPDATE
  // sequencial POR lançamento (centenas de round trips, estourando o timeout
  // da Server Action em espaços grandes e deixando a varredura pela metade).
  const groups = new Map<string, { ruleId: string; action: ReturnType<typeof actionFromRule>; ids: string[] }>();
  for (const tx of transactions) {
    const match = findMatchingRule(ruleDefs, {
      description: tx.original_description,
      amountCents: tx.amount_cents,
      direction: tx.direction,
      accountId: tx.account_id,
      cardId: tx.card_id,
    });
    if (!match) continue;

    const group = groups.get(match.id) ?? { ruleId: match.id, action: actionFromRule(match), ids: [] };
    group.ids.push(tx.id);
    groups.set(match.id, group);
  }

  let updated = 0;
  for (const group of groups.values()) {
    const effectiveNature = group.action.markTransfer
      ? ("transferencia_entre_contas" as TransactionNature)
      : (group.action.nature ?? ("nao_classificado" as TransactionNature));

    for (const ids of chunk(group.ids, 200)) {
      const { error } = await supabase
        .from("transactions")
        .update({
          nature: group.action.markTransfer ? "transferencia_entre_contas" : group.action.nature,
          category_id: group.action.categoryId ?? null,
          subcategory_id: group.action.subcategoryId ?? null,
          counterparty: group.action.counterparty ?? undefined,
          // Regra sem natureza (só categoria) ou com natureza que exige mais
          // etapas não deve marcar como classificado — antes o valor fixo
          // tirava esses lançamentos da fila de revisão indevidamente.
          classification_status: classificationStatusFor(effectiveNature, Boolean(group.action.categoryId)),
          classified_by_rule_id: group.ruleId,
        })
        .in("id", ids);

      if (!error) updated += ids.length;
    }
  }

  if (updated > 0) {
    revalidateTransactionData();
  }

  return { success: true, updatedCount: updated };
}
