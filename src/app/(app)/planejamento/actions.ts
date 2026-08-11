"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function setBudgetAction(spaceId: string, categoryId: string, referenceMonth: string, plannedAmountCents: number) {
  const supabase = await createClient();
  await supabase
    .from("budgets")
    .upsert(
      { space_id: spaceId, category_id: categoryId, reference_month: referenceMonth, planned_amount_cents: plannedAmountCents },
      { onConflict: "space_id,category_id,reference_month" },
    );
  revalidatePath("/planejamento");
}
