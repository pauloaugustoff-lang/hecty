"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteRuleAction } from "./actions";
import { Button } from "@/components/ui/button";

export function DeleteRuleButton({ ruleId }: { ruleId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Excluir esta regra?")) return;
    startTransition(async () => {
      await deleteRuleAction(ruleId);
      toast.success("Regra excluída");
    });
  }

  return (
    <Button variant="ghost" size="icon" onClick={handleClick} disabled={isPending} aria-label="Excluir regra">
      <Trash2 className="h-3.5 w-3.5 text-text-tertiary hover:text-negative" />
    </Button>
  );
}
