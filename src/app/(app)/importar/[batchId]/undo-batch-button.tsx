"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { undoImportBatchAction } from "../actions";
import { Button } from "@/components/ui/button";

export function UndoBatchButton({ batchId, spaceId }: { batchId: string; spaceId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!confirm("Desfazer esta importação? Todos os lançamentos criados por este lote serão removidos. Lançamentos de outras importações ou manuais não são afetados.")) return;
    startTransition(async () => {
      await undoImportBatchAction(batchId, spaceId);
      toast.success("Importação desfeita");
      router.refresh();
    });
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} disabled={isPending}>
      <Undo2 className="h-3.5 w-3.5" /> Desfazer importação
    </Button>
  );
}
