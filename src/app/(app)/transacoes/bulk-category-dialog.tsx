"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Tag } from "lucide-react";
import { bulkUpdateCategoryAction } from "./actions";
import type { CategoryRow } from "@/lib/data/categories";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export function BulkCategoryDialog({
  spaceId,
  categories,
  transactionIds,
  onDone,
}: {
  spaceId: string;
  categories: CategoryRow[];
  transactionIds: string[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");

  const parentCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const subcategories = useMemo(() => categories.filter((c) => c.parent_id === categoryId), [categories, categoryId]);

  function handleSubmit() {
    startTransition(async () => {
      const result = await bulkUpdateCategoryAction(spaceId, {
        transactionIds,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Categoria alterada em ${transactionIds.length} lançamento(s)`);
      setOpen(false);
      setCategoryId("");
      setSubcategoryId("");
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Tag className="h-3.5 w-3.5" /> Alterar categoria
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar categoria em massa</DialogTitle>
          <DialogDescription>Aplica a mesma categoria/subcategoria aos {transactionIds.length} lançamentos selecionados.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="bulk-category">Categoria</Label>
            <Select
              value={categoryId}
              onValueChange={(v) => {
                setCategoryId(v);
                setSubcategoryId("");
              }}
            >
              <SelectTrigger id="bulk-category">
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                {parentCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="bulk-subcategory">Subcategoria</Label>
            <Select value={subcategoryId} onValueChange={setSubcategoryId} disabled={!categoryId}>
              <SelectTrigger id="bulk-subcategory">
                <SelectValue placeholder="Sem subcategoria" />
              </SelectTrigger>
              <SelectContent>
                {subcategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </DialogClose>
          <Button variant="primary" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Salvando…" : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
