"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { toggleArchiveCategoryAction } from "./actions";
import { Button } from "@/components/ui/button";

export function ArchiveCategoryButton({ categoryId, isArchived }: { categoryId: string; isArchived: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await toggleArchiveCategoryAction(categoryId, !isArchived);
      toast.success(isArchived ? "Categoria reativada" : "Categoria arquivada");
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={isPending} aria-label={isArchived ? "Reativar" : "Arquivar"}>
      {isArchived ? <ArchiveRestore className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
    </Button>
  );
}
