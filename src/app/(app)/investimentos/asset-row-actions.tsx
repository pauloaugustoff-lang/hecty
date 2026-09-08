"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteAssetAction, deleteMovementAction, toggleArchiveAssetAction } from "./actions";
import { Button } from "@/components/ui/button";

export function ArchiveAssetButton({
  assetId,
  spaceId,
  isArchived,
}: {
  assetId: string;
  spaceId: string;
  isArchived: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await toggleArchiveAssetAction(assetId, spaceId, !isArchived);
      toast.success(isArchived ? "Ativo reativado" : "Ativo arquivado");
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={isPending}>
      {isArchived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
      {isArchived ? "Reativar" : "Arquivar"}
    </Button>
  );
}

export function DeleteAssetButton({
  assetId,
  spaceId,
  assetName,
}: {
  assetId: string;
  spaceId: string;
  assetName: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Excluir definitivamente "${assetName}"? Só é possível enquanto ele não tem nenhum movimento.`)) return;
    startTransition(async () => {
      const result = await deleteAssetAction(assetId, spaceId);
      if (result.error) toast.error(result.error);
      else toast.success("Ativo excluído");
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isPending} aria-label={`Excluir ${assetName}`}>
      <Trash2 className="h-3.5 w-3.5" /> Excluir
    </Button>
  );
}

export function DeleteMovementButton({
  movementId,
  spaceId,
  description,
  onDeleted,
}: {
  movementId: string;
  spaceId: string;
  description: string;
  onDeleted?: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Excluir o movimento "${description}"? O lançamento bancário vinculado, se houver, permanece.`)) return;
    startTransition(async () => {
      const result = await deleteMovementAction(movementId, spaceId);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Movimento excluído");
        onDeleted?.();
      }
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isPending} aria-label="Excluir movimento">
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
