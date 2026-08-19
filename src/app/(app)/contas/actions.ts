"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { accountFormSchema } from "@/lib/validation/schemas";

export interface ActionState {
  error?: string;
  success?: boolean;
}

function parseAccountFormData(formData: FormData) {
  return accountFormSchema.safeParse({
    name: formData.get("name"),
    institution: formData.get("institution") ?? "",
    type: formData.get("type"),
    initialBalanceCents: Number(formData.get("initialBalanceCents") ?? 0),
    initialBalanceDate: formData.get("initialBalanceDate"),
    currency: formData.get("currency") || "BRL",
    color: formData.get("color") ?? "#3b82f6",
  });
}

export async function createAccountAction(
  spaceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseAccountFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("accounts").insert({
    space_id: spaceId,
    name: parsed.data.name,
    institution: parsed.data.institution,
    type: parsed.data.type,
    initial_balance_cents: parsed.data.initialBalanceCents,
    initial_balance_date: parsed.data.initialBalanceDate,
    currency: parsed.data.currency,
    color: parsed.data.color,
  });

  if (error) {
    return { error: "Não foi possível criar a conta." };
  }

  revalidatePath("/contas");
  return { success: true };
}

export async function updateAccountAction(
  accountId: string,
  spaceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseAccountFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .update({
      name: parsed.data.name,
      institution: parsed.data.institution,
      type: parsed.data.type,
      initial_balance_cents: parsed.data.initialBalanceCents,
      initial_balance_date: parsed.data.initialBalanceDate,
      color: parsed.data.color,
    })
    .eq("id", accountId);

  if (error) {
    return { error: "Não foi possível salvar as alterações." };
  }

  revalidatePath("/contas");
  return { success: true };
}

export async function toggleArchiveAccountAction(accountId: string, archive: boolean) {
  const supabase = await createClient();
  await supabase.from("accounts").update({ is_archived: archive }).eq("id", accountId);
  revalidatePath("/contas");
}

/**
 * Exclusão definitiva, restrita a contas arquivadas e SEM lançamentos: o FK
 * de transactions.account_id é ON DELETE CASCADE, então excluir uma conta
 * com movimentações apagaria todas elas permanentemente (inclusive as em
 * soft delete). Conta com histórico fica arquivada, não excluída.
 */
export async function deleteAccountAction(accountId: string, spaceId: string): Promise<ActionState> {
  const supabase = await createClient();

  const { data: account } = await supabase
    .from("accounts")
    .select("id, is_archived")
    .eq("id", accountId)
    .eq("space_id", spaceId)
    .maybeSingle();
  if (!account) return { error: "Conta não encontrada." };
  if (!account.is_archived) return { error: "Arquive a conta antes de excluí-la." };

  const { count: txCount } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);
  if ((txCount ?? 0) > 0) {
    return {
      error: `Essa conta tem ${txCount} lançamento(s) — excluí-la apagaria todos permanentemente. Mantenha-a arquivada.`,
    };
  }

  const { count: cardCount } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("payment_account_id", accountId);
  if ((cardCount ?? 0) > 0) {
    return { error: "Há cartão usando esta conta como conta pagadora — troque a conta do cartão antes de excluir." };
  }

  const { error } = await supabase.from("accounts").delete().eq("id", accountId).eq("space_id", spaceId);
  if (error) return { error: "Não foi possível excluir a conta." };

  revalidatePath("/contas");
  return { success: true };
}
