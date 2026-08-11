"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { transactionFormSchema, redemptionBreakdownSchema } from "@/lib/validation/schemas";
import { normalizeDescription } from "@/lib/import/normalize";
import { computeDedupHash } from "@/lib/import/dedup";
import { buildTransferPair } from "@/lib/transactions/transfers";
import { redemptionNature } from "@/lib/money/redemption";
import { randomUUID } from "node:crypto";

export interface ActionState {
  error?: string;
  success?: boolean;
}

function classificationStatusFor(nature: string, hasCategory: boolean): "classificado" | "nao_classificado" {
  if (nature === "nao_classificado" || nature === "resgate_a_decompor") return "nao_classificado";
  if (nature === "transferencia_entre_contas" || nature === "pagamento_cartao") return "classificado";
  return hasCategory ? "classificado" : "nao_classificado";
}

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
    tags: [],
  });
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

  revalidatePath("/transacoes");
  revalidatePath("/visao-geral");
  revalidatePath("/revisar");
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

  revalidatePath("/transacoes");
  revalidatePath("/visao-geral");
  revalidatePath("/revisar");
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
  revalidatePath("/transacoes");
  revalidatePath("/visao-geral");
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

  revalidatePath("/transacoes");
  revalidatePath("/visao-geral");
  revalidatePath("/revisar");
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

  if (!fromAccountId || !toAccountId || !movementDate || !amountCents) {
    return { error: "Preencha todos os campos." };
  }

  let pair;
  try {
    pair = buildTransferPair({
      spaceId,
      fromAccountId,
      toAccountId,
      amountCents,
      movementDate,
      description,
      newId: () => randomUUID(),
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Dados inválidos." };
  }

  const supabase = await createClient();
  const dedupBase = { spaceId, movementDate, amountCents, description };

  const rows = pair.map((leg) => ({
    ...leg,
    dedup_hash: computeDedupHash({
      ...dedupBase,
      accountId: leg.account_id,
      cardId: null,
      direction: leg.direction,
    }),
    classification_status: "classificado" as const,
  }));

  const { error } = await supabase.from("transactions").insert(rows);
  if (error) {
    return { error: "Não foi possível registrar a transferência." };
  }

  revalidatePath("/transacoes");
  revalidatePath("/visao-geral");
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

  revalidatePath("/transacoes");
  revalidatePath("/visao-geral");
  revalidatePath("/cartoes");
  return { success: true };
}
