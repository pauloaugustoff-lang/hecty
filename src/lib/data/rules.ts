import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type { RuleDefinition } from "@/lib/rules/engine";

export type RuleRow = Database["public"]["Tables"]["rules"]["Row"];

export async function listRules(spaceId: string): Promise<RuleRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("rules").select("*").eq("space_id", spaceId).order("priority");
  if (error) throw error;
  return data ?? [];
}

export function toRuleDefinition(row: RuleRow): RuleDefinition {
  return {
    id: row.id,
    name: row.name,
    isActive: row.is_active,
    priority: row.priority,
    matchType: row.match_type,
    matchValue: row.match_value,
    sourceAccountId: row.source_account_id,
    sourceCardId: row.source_card_id,
    minAmountCents: row.min_amount_cents,
    maxAmountCents: row.max_amount_cents,
    direction: row.direction,
    actionNature: row.action_nature,
    actionCategoryId: row.action_category_id,
    actionSubcategoryId: row.action_subcategory_id,
    actionCounterparty: row.action_counterparty,
    actionTags: row.action_tags,
    actionNotes: row.action_notes,
    actionMarkTransfer: row.action_mark_transfer,
    actionMarkRedemption: row.action_mark_redemption,
  };
}
