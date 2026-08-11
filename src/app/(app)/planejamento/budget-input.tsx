"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setBudgetAction } from "./actions";
import { parseBRLToCents, formatCentsToBRL } from "@/lib/money/money";
import { Input } from "@/components/ui/input";

export function BudgetInput({
  spaceId,
  categoryId,
  referenceMonth,
  initialCents,
}: {
  spaceId: string;
  categoryId: string;
  referenceMonth: string;
  initialCents: number;
}) {
  const [value, setValue] = useState(initialCents > 0 ? formatCentsToBRL(initialCents).replace("R$", "").trim() : "");
  const [, startTransition] = useTransition();

  function handleBlur() {
    let cents = 0;
    try {
      cents = value ? parseBRLToCents(value) : 0;
    } catch {
      return;
    }
    if (cents === initialCents) return;

    startTransition(async () => {
      await setBudgetAction(spaceId, categoryId, referenceMonth, cents);
      toast.success("Orçamento atualizado");
    });
  }

  return (
    <Input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      placeholder="0,00"
      className="h-8 w-28 text-right tabular"
      inputMode="decimal"
    />
  );
}
