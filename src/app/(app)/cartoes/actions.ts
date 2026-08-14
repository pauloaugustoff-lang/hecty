"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cardFormSchema } from "@/lib/validation/schemas";
import { revalidateTransactionData } from "@/lib/revalidate-financial";

export interface ActionState {
  error?: string;
  success?: boolean;
}

function parseCardFormData(formData: FormData) {
  const paymentAccountId = formData.get("paymentAccountId");
  return cardFormSchema.safeParse({
    name: formData.get("name"),
    institution: formData.get("institution") ?? "",
    brand: formData.get("brand"),
    limitCents: Number(formData.get("limitCents") ?? 0),
    closingDay: Number(formData.get("closingDay")),
    dueDay: Number(formData.get("dueDay")),
    paymentAccountId: paymentAccountId ? String(paymentAccountId) : null,
  });
}

export async function createCardAction(spaceId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseCardFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("cards").insert({
    space_id: spaceId,
    name: parsed.data.name,
    institution: parsed.data.institution,
    brand: parsed.data.brand,
    limit_cents: parsed.data.limitCents,
    closing_day: parsed.data.closingDay,
    due_day: parsed.data.dueDay,
    payment_account_id: parsed.data.paymentAccountId,
  });

  if (error) return { error: "Não foi possível criar o cartão." };

  revalidatePath("/cartoes");
  return { success: true };
}

export async function updateCardAction(
  cardId: string,
  _spaceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseCardFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("cards")
    .update({
      name: parsed.data.name,
      institution: parsed.data.institution,
      brand: parsed.data.brand,
      limit_cents: parsed.data.limitCents,
      closing_day: parsed.data.closingDay,
      due_day: parsed.data.dueDay,
      payment_account_id: parsed.data.paymentAccountId,
    })
    .eq("id", cardId);

  if (error) return { error: "Não foi possível salvar as alterações." };

  // Trocar a conta pagadora (payment_account_id) muda a moeda efetiva do
  // cartão e, com ela, quais lançamentos entram nos agregados BRL do
  // dashboard/planejamento — não basta revalidar /cartoes.
  revalidateTransactionData();
  return { success: true };
}

export async function toggleArchiveCardAction(cardId: string, archive: boolean) {
  const supabase = await createClient();
  await supabase.from("cards").update({ is_archived: archive }).eq("id", cardId);
  revalidatePath("/cartoes");
}
