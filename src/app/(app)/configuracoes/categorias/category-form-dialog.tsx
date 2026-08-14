"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { createCategoryAction, updateCategoryAction, type ActionState } from "./actions";
import type { CategoryRow } from "@/lib/data/categories";
import type { CategoryKind } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Callout } from "@/components/ui/callout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const KIND_LABELS: Record<CategoryKind, string> = {
  despesa: "Despesa",
  receita: "Receita",
  investimento: "Investimento",
  transferencia: "Transferência",
  outro: "Outro",
};

const COLORS = ["#f97316", "#0ea5e9", "#8b5cf6", "#22c55e", "#14b8a6", "#ec4899", "#6366f1", "#94a3b8"];

const initialState: ActionState = {};

export function CategoryFormDialog({
  spaceId,
  parent,
  category,
}: {
  spaceId: string;
  parent?: CategoryRow;
  category?: CategoryRow;
}) {
  const isEdit = Boolean(category);
  const isSubcategory = Boolean(parent) || Boolean(category?.parent_id);
  const [open, setOpen] = useState(false);
  const boundAction = isEdit
    ? updateCategoryAction.bind(null, category!.id, spaceId)
    : createCategoryAction.bind(null, spaceId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? parent?.kind ?? "despesa");
  const [color, setColor] = useState(category?.color ?? COLORS[0]);

  useEffect(() => {
    if (state.success) {
      toast.success(isEdit ? "Categoria atualizada" : "Categoria criada");
      setOpen(false);
    }
  }, [state, isEdit]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm">
            <Pencil className="h-3 w-3" />
          </Button>
        ) : parent ? (
          <Button variant="ghost" size="sm">
            <Plus className="h-3.5 w-3.5" /> Subcategoria
          </Button>
        ) : (
          <Button variant="primary">
            <Plus className="h-4 w-4" /> Nova categoria
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar categoria" : parent ? `Nova subcategoria de ${parent.name}` : "Nova categoria"}
          </DialogTitle>
        </DialogHeader>

        {state.error ? (
          <Callout tone="danger" className="mb-4">
            {state.error}
          </Callout>
        ) : null}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="color" value={color} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="parentId" value={parent?.id ?? category?.parent_id ?? ""} />

          <div>
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" required defaultValue={category?.name} placeholder="Ex.: Assinaturas" />
          </div>

          {!isSubcategory ? (
            <div>
              <Label htmlFor="kind">Tipo</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as CategoryKind)} disabled={isEdit}>
                <SelectTrigger id="kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div>
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
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
