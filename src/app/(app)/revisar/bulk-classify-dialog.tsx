"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Tags } from "lucide-react";
import { bulkClassifyAction } from "./actions";
import type { TransactionWithRelations } from "@/lib/data/transactions";
import type { CategoryRow } from "@/lib/data/categories";
import type { TransactionNature } from "@/lib/supabase/types";
import { natureLabels } from "@/lib/domain/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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

export function BulkClassifyDialog({
  spaceId,
  userId,
  categories,
  selectedTransactions,
  onDone,
}: {
  spaceId: string;
  userId: string;
  categories: CategoryRow[];
  selectedTransactions: TransactionWithRelations[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [nature, setNature] = useState<TransactionNature>("despesa");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [createRule, setCreateRule] = useState(true);

  const parentCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const subcategories = useMemo(() => categories.filter((c) => c.parent_id === categoryId), [categories, categoryId]);

  const commonDescription = useMemo(() => {
    const descriptions = new Set(selectedTransactions.map((t) => t.normalized_description));
    return descriptions.size === 1 ? selectedTransactions[0]?.normalized_description : null;
  }, [selectedTransactions]);

  function handleSubmit() {
    startTransition(async () => {
      const result = await bulkClassifyAction(spaceId, userId, {
        transactionIds: selectedTransactions.map((t) => t.id),
        nature,
        categoryId: categoryId || null,
        subcategoryId: subcategoryId || null,
        counterparty: counterparty || null,
        createRule: createRule && Boolean(commonDescription),
        ruleMatchValue: commonDescription,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`${result.updatedCount} lançamento(s) classificado(s)`);
      setOpen(false);
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary" size="sm">
          <Tags className="h-3.5 w-3.5" /> Classificar {selectedTransactions.length} selecionado(s)
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Classificar em massa</DialogTitle>
          <DialogDescription>
            Aplica a mesma classificação aos {selectedTransactions.length} lançamentos selecionados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="nature">Natureza</Label>
            <Select value={nature} onValueChange={(v) => setNature(v as TransactionNature)}>
              <SelectTrigger id="nature">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(natureLabels)
                  .filter(([value]) => value !== "transferencia_entre_contas" && value !== "pagamento_cartao")
                  .map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="category">Categoria</Label>
              <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setSubcategoryId(""); }}>
                <SelectTrigger id="category">
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
              <Label htmlFor="subcategory">Subcategoria</Label>
              <Select value={subcategoryId} onValueChange={setSubcategoryId} disabled={!categoryId}>
                <SelectTrigger id="subcategory">
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
          <div>
            <Label htmlFor="counterparty">Estabelecimento (opcional, aplica a todos)</Label>
            <Input id="counterparty" value={counterparty} onChange={(e) => setCounterparty(e.target.value)} />
          </div>

          {commonDescription ? (
            <label className="flex items-start gap-2 rounded-[var(--radius-md)] border border-accent/30 bg-accent-soft/40 p-3 text-[13px] text-text-secondary">
              <Checkbox checked={createRule} onCheckedChange={(v) => setCreateRule(v === true)} className="mt-0.5" />
              <span>
                Aplicar esta classificação aos lançamentos semelhantes no futuro e criar uma regra para{" "}
                <strong className="text-text-primary">&quot;{commonDescription}&quot;</strong>.
              </span>
            </label>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </DialogClose>
          <Button variant="primary" onClick={handleSubmit} disabled={isPending}>
            {isPending ? "Classificando…" : "Classificar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
