"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTagAction } from "./actions";
import { Button } from "@/components/ui/button";

export function DeleteTagButton({
  tagId,
  spaceId,
  tagName,
  usageCount,
}: {
  tagId: string;
  spaceId: string;
  tagName: string;
  usageCount: number;
}) {
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const warning =
      usageCount > 0
        ? `Excluir a tag "${tagName}"? Ela será removida de ${usageCount} lançamento(s) — os lançamentos em si não são alterados.`
        : `Excluir a tag "${tagName}"?`;
    if (!confirm(warning)) return;

    startTransition(async () => {
      const result = await deleteTagAction(tagId, spaceId);
      if (result.error) toast.error(result.error);
      else toast.success("Tag excluída");
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDelete} disabled={isPending} aria-label={`Excluir tag ${tagName}`}>
      <Trash2 className="h-3.5 w-3.5" /> Excluir
    </Button>
  );
}
