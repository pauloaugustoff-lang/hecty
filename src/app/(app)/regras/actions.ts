"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ruleFormSchema } from "@/lib/validation/schemas";

export interface ActionState {
  error?: string;
  success?: boolean;
}

function parseRuleFormData(formData: FormData) {
  function str(name: string): string | null {
    const v = formData.get(name);
    return v ? String(v) : null;
  }
  function num(name: string): number | null {
    const v = formData.get(name);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  return ruleFormSchema.safeParse({
    name: formData.get("name"),
    isActive: formData.get("isActive") === "true",
    priority: Number(formData.get("priority") ?? 100),
    matchType: formData.get("matchType"),
    matchValues: formData.getAll("matchValues").map(String),
    sourceAccountId: str("sourceAccountId"),
    sourceCardId: str("sourceCardId"),
    minAmountCents: num("minAmountCents"),
    maxAmountCents: num("maxAmountCents"),
    direction: str("direction"),
    actionNature: str("actionNature"),
    actionCategoryId: str("actionCategoryId"),
    actionSubcategoryId: str("actionSubcategoryId"),
    actionCounterparty: str("actionCounterparty"),
    actionNotes: str("actionNotes"),
    actionMarkTransfer: formData.get("actionMarkTransfer") === "true",
    actionMarkRedemption: formData.get("actionMarkRedemption") === "true",
  });
}

export async function createRuleAction(
  spaceId: string,
  userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseRuleFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("rules").insert({
    space_id: spaceId,
    name: parsed.data.name,
    is_active: parsed.data.isActive,
    priority: parsed.data.priority,
    match_type: parsed.data.matchType,
    match_values: parsed.data.matchValues,
    source_account_id: parsed.data.sourceAccountId,
    source_card_id: parsed.data.sourceCardId,
    min_amount_cents: parsed.data.minAmountCents,
    max_amount_cents: parsed.data.maxAmountCents,
    direction: parsed.data.direction,
    action_nature: parsed.data.actionNature,
    action_category_id: parsed.data.actionCategoryId,
    action_subcategory_id: parsed.data.actionSubcategoryId,
    action_counterparty: parsed.data.actionCounterparty,
    action_notes: parsed.data.actionNotes,
    action_mark_transfer: parsed.data.actionMarkTransfer,
    action_mark_redemption: parsed.data.actionMarkRedemption,
    created_by: userId,
  });

  if (error) return { error: "Não foi possível criar a regra." };

  revalidatePath("/regras");
  return { success: true };
}

export async function updateRuleAction(
  ruleId: string,
  _spaceId: string,
  _userId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = parseRuleFormData(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("rules")
    .update({
      name: parsed.data.name,
      is_active: parsed.data.isActive,
      priority: parsed.data.priority,
      match_type: parsed.data.matchType,
      match_values: parsed.data.matchValues,
      source_account_id: parsed.data.sourceAccountId,
      source_card_id: parsed.data.sourceCardId,
      min_amount_cents: parsed.data.minAmountCents,
      max_amount_cents: parsed.data.maxAmountCents,
      direction: parsed.data.direction,
      action_nature: parsed.data.actionNature,
      action_category_id: parsed.data.actionCategoryId,
      action_subcategory_id: parsed.data.actionSubcategoryId,
      action_counterparty: parsed.data.actionCounterparty,
      action_notes: parsed.data.actionNotes,
      action_mark_transfer: parsed.data.actionMarkTransfer,
      action_mark_redemption: parsed.data.actionMarkRedemption,
    })
    .eq("id", ruleId);

  if (error) return { error: "Não foi possível salvar as alterações." };

  revalidatePath("/regras");
  return { success: true };
}

export async function deleteRuleAction(ruleId: string) {
  const supabase = await createClient();
  await supabase.from("rules").delete().eq("id", ruleId);
  revalidatePath("/regras");
}

export async function toggleRuleActiveAction(ruleId: string, isActive: boolean) {
  const supabase = await createClient();
  await supabase.from("rules").update({ is_active: isActive }).eq("id", ruleId);
  revalidatePath("/regras");
}
