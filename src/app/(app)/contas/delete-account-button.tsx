"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAccountAction } from "./actions";
import { Button } from "@/components/ui/button";

export function DeleteAccountButton({
  accountId,
  spaceId,
  accountName,
}: {
  accountId: string;
  spaceId: string;
  accountName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Excluir definitivamente a conta "${accountName}"? Só é possível quando ela não tem nenhum lançamento.`)) {
      return;
    }
    startTransition(async () => {
      const result = await deleteAccountAction(accountId, spaceId);
      if (result.error) toast.error(result.error);
      else toast.success("Conta excluída");
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isPending} aria-label={`Excluir conta ${accountName}`}>
      <Trash2 className="h-3.5 w-3.5" /> Excluir
    </Button>
  );
}
