"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { toggleArchiveAccountAction } from "./actions";
import { Button } from "@/components/ui/button";

export function ArchiveAccountButton({ accountId, isArchived }: { accountId: string; isArchived: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await toggleArchiveAccountAction(accountId, !isArchived);
      toast.success(isArchived ? "Conta reativada" : "Conta arquivada");
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={isPending}>
      {isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
      {isArchived ? "Reativar" : "Arquivar"}
    </Button>
  );
}
