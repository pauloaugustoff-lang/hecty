"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTransactionAction } from "./actions";
import { Button } from "@/components/ui/button";

export function DeleteTransactionButton({ transactionId }: { transactionId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Excluir este lançamento? Ele pode ser recuperado pelo administrador do espaço se necessário.")) return;
    startTransition(async () => {
      await deleteTransactionAction(transactionId);
      toast.success("Lançamento excluído");
    });
  }

  return (
    <Button variant="ghost" size="icon" onClick={handleClick} disabled={isPending} aria-label="Excluir lançamento">
      <Trash2 className="h-3.5 w-3.5 text-text-tertiary hover:text-negative" />
    </Button>
  );
}
