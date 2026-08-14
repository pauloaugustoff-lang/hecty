"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Tag } from "lucide-react";
import { bulkUpdateCategoryAction } from "./actions";
import type { CategoryRow } from "@/lib/data/categories";
import type { TransactionNature } from "@/lib/supabase/types";
import { natureLabels, categoryKindForNature } from "@/lib/domain/labels";
import { sortByName, sortEntriesByLabel } from "@/lib/utils/sort";
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
  const [nature, setNature] = useState<TransactionNature | "">("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");

  // Sem dado de direção aqui (só os ids foram passados) — naturezas ambíguas
  // por si só (empréstimo, ajuste, não classificado) ficam sem filtro.
  const categoryKind = nature ? categoryKindForNature(nature) : null;
  const parentCategories = useMemo(
    () => sortByName(categories.filter((c) => !c.parent_id && (!categoryKind || c.kind === categoryKind))),
    [categories, categoryKind],
  );
  const subcategories = useMemo(
    () => sortByName(categories.filter((c) => c.parent_id === categoryId)),
    [categories, categoryId],
  );

  function changeNature(next: TransactionNature | "") {
    const nextKind = next ? categoryKindForNature(next) : null;
    if (nextKind && categoryId) {
      const current = categories.find((c) => c.id === categoryId);
      if (current && current.kind !== nextKind) {
        setCategoryId("");
        setSubcategoryId("");
      }
    }
    setNature(next);
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await bulkUpdateCategoryAction(spaceId, {
        transactionIds,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        nature: nature || null,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Classificação alterada em ${transactionIds.length} lançamento(s)`);
      setOpen(false);
      setNature("");
      setCategoryId("");
      setSubcategoryId("");
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Tag className="h-3.5 w-3.5" /> Alterar classificação
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Alterar classificação em massa</DialogTitle>
          <DialogDescription>
            Aplica a mesma natureza/categoria/subcategoria aos {transactionIds.length} lançamentos selecionados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="bulk-nature">Natureza</Label>
            <Select value={nature || "none"} onValueChange={(v) => changeNature(v === "none" ? "" : (v as TransactionNature))}>
              <SelectTrigger id="bulk-nature">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Não alterar natureza</SelectItem>
                {sortEntriesByLabel(
                  Object.entries(natureLabels).filter(
                    ([value]) => value !== "transferencia_entre_contas" && value !== "pagamento_cartao",
                  ),
                ).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
