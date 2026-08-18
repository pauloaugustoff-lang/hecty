"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { transactionFormSchema, redemptionBreakdownSchema, tagFormSchema } from "@/lib/validation/schemas";
import type { TagRow } from "@/lib/data/tags";
import { normalizeDescription } from "@/lib/import/normalize";
import { computeDedupHash } from "@/lib/import/dedup";
import { buildTransferPair } from "@/lib/transactions/transfers";
import { redemptionNature } from "@/lib/money/redemption";
import { parseDecimalPtBR } from "@/lib/money/money";
import { classificationStatusFor } from "@/lib/domain/classification";
import { revalidateTransactionData } from "@/lib/revalidate-financial";
import { randomUUID } from "node:crypto";
import type { TransactionNature } from "@/lib/supabase/types";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export interface ExpenseSearchResult {
  id: string;
  originalDescription: string;
  amountCents: number;
  movementDate: string;
  categoryName: string | null;
}

/** Usado no picker "Qual despesa isso reembolsa?" ao lançar um reembolso. */
export async function searchExpenseTransactionsAction(spaceId: string, query: string): Promise<ExpenseSearchResult[]> {
  if (!query.trim()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, original_description, amount_cents, movement_date, category:categories!transactions_category_id_fkey(name)")
    .eq("space_id", spaceId)
    .eq("nature", "despesa")
    .eq("direction", "saida")
    .is("deleted_at", null)
    .ilike("normalized_description", `%${normalizeDescription(query)}%`)
    .order("movement_date", { ascending: false })
    .limit(10);

  if (error || !data) return [];

  return data.map((tx) => ({
    id: tx.id,
    originalDescription: tx.original_description,
    amountCents: tx.amount_cents,
    movementDate: tx.movement_date,
    categoryName: (tx.category as unknown as { name: string } | null)?.name ?? null,
  }));
}

/** Usado no picker "Qual receita esse repasse abate?" ao lançar um repasse a terceiros. */
export async function searchRevenueTransactionsAction(spaceId: string, query: string): Promise<ExpenseSearchResult[]> {
  if (!query.trim()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select("id, original_description, amount_cents, movement_date, category:categories!transactions_category_id_fkey(name)")
    .eq("space_id", spaceId)
    .in("nature", ["receita_trabalho", "rendimento_investimento", "outras_receitas"])
    .eq("direction", "entrada")
    .is("deleted_at", null)
    .ilike("normalized_description", `%${normalizeDescription(query)}%`)
    .order("movement_date", { ascending: false })
    .limit(10);

  if (error || !data) return [];

  return data.map((tx) => ({
    id: tx.id,
    originalDescription: tx.original_description,
    amountCents: tx.amount_cents,
    movementDate: tx.movement_date,
    categoryName: (tx.category as unknown as { name: string } | null)?.name ?? null,
  }));
}

// Naturezas que abatem um lançamento vinculado: reembolso/estorno (entrada
// abatendo despesas) e repasse (saída abatendo receitas — dinheiro que nunca
// foi seu, ex.: parte do sócio num alvará recebido).
const REIMBURSING_NATURES = new Set(["reembolso", "estorno", "repasse"]);

function parseTransactionFormData(formData: FormData) {
  const accountId = formData.get("accountId");
  const cardId = formData.get("cardId");
  const categoryId = formData.get("categoryId");
  const subcategoryId = formData.get("subcategoryId");

  return transactionFormSchema.safeParse({
    movementDate: formData.get("movementDate"),
    competenceDate: formData.get("competenceDate") || formData.get("movementDate"),
    originalDescription: formData.get("description"),
    amountCents: Number(formData.get("amountCents")),
    direction: formData.get("direction"),
    nature: formData.get("nature"),
    accountId: accountId ? String(accountId) : null,
    cardId: cardId ? String(cardId) : null,
    categoryId: categoryId ? String(categoryId) : null,
    subcategoryId: subcategoryId ? String(subcategoryId) : null,
    counterparty: formData.get("counterparty") ?? "",
    notes: formData.get("notes") ?? "",
    tags: formData.getAll("tags").map(String),
    linkedExpenseIds: formData.getAll("linkedExpenseIds").map(String),
  });
}

export interface TagActionState {
  error?: string;
  success?: boolean;
  tag?: TagRow;
}

/** Usado no picker de tags do lançamento ("+ Criar tag"). */
export async function createTagAction(spaceId: string, _prev: TagActionState, formData: FormData): Promise<TagActionState> {
  const parsed = tagFormSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") ?? "#8b5cf6",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { data: tag, error } = await supabase
    .from("tags")
    .insert({ space_id: spaceId, name: parsed.data.name, color: parsed.data.color })
    .select("*")
    .single();

  if (error || !tag) {
    return { error: "Não foi possível criar a tag." };
  }

  revalidateTransactionData();
  revalidatePath("/configuracoes/tags");
  return { success: true, tag };
}

/** Substitui os vínculos de um reembolso/estorno pelas despesas selecionadas.
 * O valor do PRÓPRIO reembolso/estorno (não o da despesa) é distribuído entre
 * as despesas vinculadas, proporcionalmente ao valor de cada uma — cobre tanto
 * o caso de reembolso parcial (estorno de metade de uma mensalidade) quanto o
 * de um único pagamento cobrindo várias despesas. Fora dessas naturezas,
 * qualquer vínculo antigo (ex.: usuário trocou a natureza) é removido. */
async function syncReimbursementLinks(
  transactionId: string,
  spaceId: string,
  nature: string,
  expenseIds: string[],
  reimbursementAmountCents: number,
) {
  const supabase = await createClient();
  await supabase.from("transaction_reimbursement_links").delete().eq("reimbursement_transaction_id", transactionId);

  if (!REIMBURSING_NATURES.has(nature) || expenseIds.length === 0) return;

  const { data: expenses } = await supabase.from("transactions").select("id, amount_cents").in("id", expenseIds);
  if (!expenses?.length) return;

  const totalExpenseAmount = expenses.reduce((sum, e) => sum + e.amount_cents, 0);
  if (totalExpenseAmount === 0) return;

  let remaining = reimbursementAmountCents;
  const links = expenses
    .map((e, i) => {
      const isLast = i === expenses.length - 1;
      const share = isLast ? remaining : Math.round((e.amount_cents / totalExpenseAmount) * reimbursementAmountCents);
      remaining -= share;
      return {
        space_id: spaceId,
        reimbursement_transaction_id: transactionId,
        expense_transaction_id: e.id,
        allocated_amount_cents: share,
      };
    })
    // allocated_amount_cents > 0 é obrigatório no banco.
    .filter((link) => link.allocated_amount_cents > 0);

  if (links.length > 0) {
    await supabase.from("transaction_reimbursement_links").insert(links);
  }
}

export async function createTransactionAction(
  spaceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseTransactionFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const normalized = normalizeDescription(parsed.data.originalDescription);
  const dedupHash = computeDedupHash({
    spaceId,
    accountId: parsed.data.accountId,
    cardId: parsed.data.cardId,
    movementDate: parsed.data.movementDate,
    amountCents: parsed.data.amountCents,
    direction: parsed.data.direction,
    description: parsed.data.originalDescription,
  });

  const { data: inserted, error } = await supabase
    .from("transactions")
    .insert({
      space_id: spaceId,
      account_id: parsed.data.accountId,
      card_id: parsed.data.cardId,
      movement_date: parsed.data.movementDate,
      competence_date: parsed.data.competenceDate,
      original_description: parsed.data.originalDescription,
      normalized_description: normalized,
      amount_cents: parsed.data.amountCents,
      direction: parsed.data.direction,
      nature: parsed.data.nature,
      category_id: parsed.data.categoryId,
      subcategory_id: parsed.data.subcategoryId,
      counterparty: parsed.data.counterparty,
      notes: parsed.data.notes,
      tags: parsed.data.tags,
      origin: "manual",
      classification_status: classificationStatusFor(parsed.data.nature, Boolean(parsed.data.categoryId)),
      dedup_hash: dedupHash,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: "Não foi possível criar o lançamento." };
  }

  if (parsed.data.nature === "resgate_investimento" || parsed.data.nature === "resgate_a_decompor") {
    await upsertRedemptionFromFormData(inserted.id, spaceId, parsed.data.amountCents, formData);
  }
  await syncReimbursementLinks(inserted.id, spaceId, parsed.data.nature, parsed.data.linkedExpenseIds ?? [], parsed.data.amountCents);

  revalidateTransactionData();
  return { success: true };
}

export async function updateTransactionAction(
  transactionId: string,
  spaceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseTransactionFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const normalized = normalizeDescription(parsed.data.originalDescription);
  const dedupHash = computeDedupHash({
    spaceId,
    accountId: parsed.data.accountId,
    cardId: parsed.data.cardId,
    movementDate: parsed.data.movementDate,
    amountCents: parsed.data.amountCents,
    direction: parsed.data.direction,
    description: parsed.data.originalDescription,
  });

  const { error } = await supabase
    .from("transactions")
    .update({
      account_id: parsed.data.accountId,
      card_id: parsed.data.cardId,
      movement_date: parsed.data.movementDate,
      competence_date: parsed.data.competenceDate,
      original_description: parsed.data.originalDescription,
      normalized_description: normalized,
      amount_cents: parsed.data.amountCents,
      direction: parsed.data.direction,
      nature: parsed.data.nature,
      category_id: parsed.data.categoryId,
      subcategory_id: parsed.data.subcategoryId,
      counterparty: parsed.data.counterparty,
      notes: parsed.data.notes,
      tags: parsed.data.tags,
      classification_status: classificationStatusFor(parsed.data.nature, Boolean(parsed.data.categoryId)),
      dedup_hash: dedupHash,
    })
    .eq("id", transactionId);

  if (error) {
    return { error: "Não foi possível salvar as alterações." };
  }

  if (parsed.data.nature === "resgate_investimento" || parsed.data.nature === "resgate_a_decompor") {
    await upsertRedemptionFromFormData(transactionId, spaceId, parsed.data.amountCents, formData);
  } else {
    await supabase.from("redemption_details").delete().eq("transaction_id", transactionId);
  }
  await syncReimbursementLinks(transactionId, spaceId, parsed.data.nature, parsed.data.linkedExpenseIds ?? [], parsed.data.amountCents);

  revalidateTransactionData();
  return { success: true };
}

async function upsertRedemptionFromFormData(
  transactionId: string,
  spaceId: string,
  totalAmountCents: number,
  formData: FormData,
) {
  const raw = {
    totalAmountCents,
    principalCents: numberOrNull(formData.get("principalCents")),
    grossYieldCents: numberOrNull(formData.get("grossYieldCents")),
    taxCents: numberOrNull(formData.get("taxCents")),
    feesCents: numberOrNull(formData.get("feesCents")),
    netYieldCents: numberOrNull(formData.get("netYieldCents")),
    institution: String(formData.get("redemptionInstitution") ?? ""),
    product: String(formData.get("redemptionProduct") ?? ""),
    applicationDate: emptyToNull(formData.get("applicationDate")),
    redemptionDate: emptyToNull(formData.get("redemptionDate")),
  };

  const parsed = redemptionBreakdownSchema.safeParse(raw);
  if (!parsed.success) return;

  const supabase = await createClient();
  const nature = redemptionNature(parsed.data);

  await supabase.from("redemption_details").upsert({
    transaction_id: transactionId,
    space_id: spaceId,
    total_amount_cents: parsed.data.totalAmountCents,
    principal_cents: parsed.data.principalCents ?? null,
    gross_yield_cents: parsed.data.grossYieldCents ?? null,
    tax_cents: parsed.data.taxCents ?? null,
    fees_cents: parsed.data.feesCents ?? null,
    net_yield_cents: parsed.data.netYieldCents ?? null,
    institution: parsed.data.institution,
    product: parsed.data.product,
    application_date: parsed.data.applicationDate ?? null,
    redemption_date: parsed.data.redemptionDate ?? null,
  });

  await supabase
    .from("transactions")
    .update({
      nature,
      classification_status: nature === "resgate_a_decompor" ? "nao_classificado" : "classificado",
    })
    .eq("id", transactionId);
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  if (value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function emptyToNull(value: FormDataEntryValue | null): string | null {
  if (value === null || value === "") return null;
  return String(value);
}

export async function deleteTransactionAction(transactionId: string) {
  const supabase = await createClient();
  await supabase.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", transactionId);
  revalidateTransactionData();
}

export async function deleteTransactionsAction(transactionIds: string[]): Promise<ActionState> {
  if (transactionIds.length === 0) return { error: "Nenhum lançamento selecionado." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", transactionIds);

  if (error) {
    return { error: "Não foi possível excluir os lançamentos selecionados." };
  }

  revalidateTransactionData();
  return { success: true };
}

export interface BulkUpdateCategoryInput {
  transactionIds: string[];
  /** undefined = não alterar; null = remover categoria; id = definir. */
  categoryId?: string | null;
  subcategoryId?: string | null;
  /** null = não alterar a natureza dos lançamentos selecionados. */
  nature: TransactionNature | null;
  /** Tags a ACRESCENTAR às existentes de cada lançamento (nunca substitui). */
  addTags?: string[];
}

export async function bulkUpdateCategoryAction(spaceId: string, input: BulkUpdateCategoryInput): Promise<ActionState> {
  if (input.transactionIds.length === 0) return { error: "Nenhum lançamento selecionado." };

  const touchesCategory = input.categoryId !== undefined;
  const addTags = input.addTags ?? [];
  if (!touchesCategory && !input.nature && addTags.length === 0) {
    return { error: "Nenhuma alteração selecionada." };
  }

  const supabase = await createClient();

  // Tags acrescentam às existentes (payload difere por linha) e, quando a
  // natureza muda sem mexer na categoria, o status depende da categoria que
  // cada linha JÁ tem — nos dois casos é preciso ler as linhas antes.
  const needsRowData = addTags.length > 0 || (Boolean(input.nature) && !touchesCategory);

  if (!needsRowData) {
    const update: {
      category_id?: string | null;
      subcategory_id?: string | null;
      nature?: TransactionNature;
      classification_status?: "classificado" | "nao_classificado";
    } = {};
    if (touchesCategory) {
      update.category_id = input.categoryId ?? null;
      update.subcategory_id = input.subcategoryId ?? null;
    }
    if (input.nature) {
      update.nature = input.nature;
      update.classification_status = classificationStatusFor(input.nature, Boolean(input.categoryId));
    }

    const { error } = await supabase.from("transactions").update(update).eq("space_id", spaceId).in("id", input.transactionIds);
    if (error) {
      return { error: "Não foi possível alterar os lançamentos selecionados." };
    }
  } else {
    const { data: rows, error: fetchError } = await supabase
      .from("transactions")
      .select("id, tags, category_id")
      .eq("space_id", spaceId)
      .in("id", input.transactionIds);
    if (fetchError || !rows) {
      return { error: "Não foi possível carregar os lançamentos selecionados." };
    }

    // Linhas com o mesmo payload final (mesmas tags resultantes etc.) vão num
    // único UPDATE — no caso comum (todas sem tag) isso é UMA chamada.
    interface BulkRowPayload {
      category_id?: string | null;
      subcategory_id?: string | null;
      nature?: TransactionNature;
      classification_status?: "classificado" | "nao_classificado";
      tags?: string[];
    }
    const groups = new Map<string, { payload: BulkRowPayload; ids: string[] }>();
    for (const row of rows) {
      const payload: BulkRowPayload = {};
      if (touchesCategory) {
        payload.category_id = input.categoryId ?? null;
        payload.subcategory_id = input.subcategoryId ?? null;
      }
      if (input.nature) {
        const finalCategoryId = touchesCategory ? input.categoryId : row.category_id;
        payload.nature = input.nature;
        payload.classification_status = classificationStatusFor(input.nature, Boolean(finalCategoryId));
      }
      if (addTags.length > 0) {
        payload.tags = Array.from(new Set([...(row.tags ?? []), ...addTags]));
      }

      const key = JSON.stringify(payload);
      const group = groups.get(key) ?? { payload, ids: [] };
      group.ids.push(row.id);
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      const { error } = await supabase.from("transactions").update(group.payload).eq("space_id", spaceId).in("id", group.ids);
      if (error) {
        return { error: "Não foi possível alterar os lançamentos selecionados." };
      }
    }
  }

  revalidateTransactionData();
  return { success: true };
}

export interface TransferActionState {
  error?: string;
  success?: boolean;
}

export async function createTransferAction(
  spaceId: string,
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  const fromAccountId = String(formData.get("fromAccountId") ?? "");
  const toAccountId = String(formData.get("toAccountId") ?? "");
  const movementDate = String(formData.get("movementDate") ?? "");
  const description = String(formData.get("description") ?? "Transferência entre contas");
  const amountCents = Number(formData.get("amountCents") ?? 0);
  const rateInput = String(formData.get("exchangeRate") ?? "").trim();

  if (!fromAccountId || !toAccountId || !movementDate || !amountCents) {
    return { error: "Preencha todos os campos." };
  }

  const supabase = await createClient();
  const { data: transferAccounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, currency")
    .in("id", [fromAccountId, toAccountId]);
  const fromCurrency = transferAccounts?.find((a) => a.id === fromAccountId)?.currency;
  const toCurrency = transferAccounts?.find((a) => a.id === toAccountId)?.currency;
  // Falha aqui tem que ser ruidosa: se as moedas caíssem num padrão "BRL" por
  // engano, uma transferência USD→BRL pularia a conversão e creditaria os
  // mesmos centavos na conta de destino como se fossem reais.
  if (accountsError || !fromCurrency || !toCurrency) {
    return { error: "Não foi possível confirmar as moedas das contas. Tente novamente." };
  }

  let toAmountCents: number | undefined;
  let notes = "";
  if (fromCurrency !== toCurrency) {
    let rate: number;
    try {
      rate = parseDecimalPtBR(rateInput);
    } catch {
      return { error: `Informe a cotação usada (1 ${fromCurrency} = ? ${toCurrency}).` };
    }
    if (rate <= 0) {
      return { error: "A cotação deve ser maior que zero." };
    }
    toAmountCents = Math.round(amountCents * rate);
    notes = `Câmbio: 1 ${fromCurrency} = ${rate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 6 })} ${toCurrency}`;
  }

  let pair;
  try {
    pair = buildTransferPair({
      spaceId,
      fromAccountId,
      toAccountId,
      amountCents,
      toAmountCents,
      movementDate,
      description,
      notes,
      newId: () => randomUUID(),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Dados inválidos." };
  }

  const dedupBase = { spaceId, movementDate, description };

  const rows = pair.map((leg) => ({
    ...leg,
    dedup_hash: computeDedupHash({
      ...dedupBase,
      accountId: leg.account_id,
      cardId: null,
      amountCents: leg.amount_cents,
      direction: leg.direction,
    }),
    classification_status: "classificado" as const,
  }));

  const { error } = await supabase.from("transactions").insert(rows);
  if (error) {
    return { error: "Não foi possível registrar a transferência." };
  }

  revalidateTransactionData();
  return { success: true };
}

export interface CardPaymentActionState {
  error?: string;
  success?: boolean;
}

export async function createCardPaymentAction(
  spaceId: string,
  _prev: CardPaymentActionState,
  formData: FormData,
): Promise<CardPaymentActionState> {
  const accountId = String(formData.get("accountId") ?? "");
  const cardId = String(formData.get("cardId") ?? "");
  const movementDate = String(formData.get("movementDate") ?? "");
  const amountCents = Number(formData.get("amountCents") ?? 0);

  if (!accountId || !cardId || !movementDate || !amountCents) {
    return { error: "Preencha todos os campos." };
  }

  const supabase = await createClient();
  const { data: card } = await supabase.from("cards").select("name").eq("id", cardId).maybeSingle();
  const description = `Pagamento fatura ${card?.name ?? "cartão"}`;

  const dedupHash = computeDedupHash({
    spaceId,
    accountId,
    cardId: null,
    movementDate,
    amountCents,
    direction: "saida",
    description,
  });

  const { error } = await supabase.from("transactions").insert({
    space_id: spaceId,
    account_id: accountId,
    card_id: null,
    paid_card_id: cardId,
    movement_date: movementDate,
    competence_date: movementDate,
    original_description: description,
    normalized_description: normalizeDescription(description),
    amount_cents: amountCents,
    direction: "saida",
    nature: "pagamento_cartao",
    origin: "manual",
    classification_status: "classificado",
    dedup_hash: dedupHash,
  });

  if (error) {
    return { error: "Não foi possível registrar o pagamento." };
  }

  revalidateTransactionData();
  return { success: true };
}
