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
