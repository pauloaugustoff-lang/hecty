"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { updateTagAction, type TagActionState } from "./actions";
import { createTagAction } from "../../transacoes/actions";
import type { TagRow } from "@/lib/data/tags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Callout } from "@/components/ui/callout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

const TAG_COLORS = ["#f97316", "#0ea5e9", "#8b5cf6", "#22c55e", "#14b8a6", "#ec4899", "#6366f1", "#94a3b8"];

const initialState: TagActionState = {};

export function TagFormDialog({ spaceId, tag }: { spaceId: string; tag?: TagRow }) {
  const isEdit = Boolean(tag);
  const [open, setOpen] = useState(false);
  const boundAction = isEdit ? updateTagAction.bind(null, tag!.id, spaceId) : createTagAction.bind(null, spaceId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const [color, setColor] = useState(tag?.color ?? TAG_COLORS[2]);

  useEffect(() => {
    if (state.success) {
      toast.success(isEdit ? "Tag atualizada" : "Tag criada");
      setOpen(false);
    }
  }, [state, isEdit]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm" aria-label={`Editar tag ${tag?.name}`}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        ) : (
          <Button variant="primary">
            <Plus className="h-4 w-4" /> Nova tag
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar tag" : "Nova tag"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Renomear atualiza a tag em todos os lançamentos que já a usam."
              : "Tags marcam lançamentos que atravessam várias categorias — ex.: uma viagem."}
          </DialogDescription>
        </DialogHeader>

        {state.error ? (
          <Callout tone="danger" className="mb-4">
            {state.error}
          </Callout>
        ) : null}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="color" value={color} />

          <div>
            <Label htmlFor="tag-name">Nome</Label>
            <Input id="tag-name" name="name" required defaultValue={tag?.name} placeholder="Viagem Tiradentes" maxLength={40} />
          </div>
          <div>
            <Label>Cor</Label>
            <div className="flex gap-2">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-6 w-6 rounded-full border-2 transition-transform"
                  style={{ backgroundColor: c, borderColor: color === c ? "var(--text-primary)" : "transparent" }}
                  aria-label={`Selecionar cor ${c}`}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
