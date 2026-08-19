"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Tag, Plus, X, Search } from "lucide-react";
import { bulkUpdateCategoryAction, createTagAction } from "./actions";
import type { CategoryRow } from "@/lib/data/categories";
import type { TagRow } from "@/lib/data/tags";
import type { TransactionNature } from "@/lib/supabase/types";
import { natureLabels, categoryKindForNature } from "@/lib/domain/labels";
import { sortByName, sortEntriesByLabel } from "@/lib/utils/sort";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
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

// Sentinelas do select de categoria: "keep" = não alterar (padrão — antes o
// diálogo SEMPRE gravava a categoria, e aplicar sem escolher uma apagava a
// categoria de todos os selecionados), "none" = remover explicitamente.
const KEEP_CATEGORY = "keep";
const CLEAR_CATEGORY = "none";

const TAG_COLORS = ["#f97316", "#0ea5e9", "#8b5cf6", "#22c55e", "#14b8a6", "#ec4899", "#6366f1", "#94a3b8"];

export function BulkCategoryDialog({
  spaceId,
  categories,
  tags,
  transactionIds,
  onDone,
}: {
  spaceId: string;
  categories: CategoryRow[];
  tags: TagRow[];
  transactionIds: string[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [nature, setNature] = useState<TransactionNature | "">("");
  const [categoryChoice, setCategoryChoice] = useState(KEEP_CATEGORY);
  const [subcategoryId, setSubcategoryId] = useState("");

  const [description, setDescription] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [notes, setNotes] = useState("");
  const [localTags, setLocalTags] = useState<TagRow[]>(tags);
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);
  const [tagSearch, setTagSearch] = useState("");
  const [isCreatingTag, startCreateTagTransition] = useTransition();

  const hasRealCategory = categoryChoice !== KEEP_CATEGORY && categoryChoice !== CLEAR_CATEGORY;

  // Sem dado de direção aqui (só os ids foram passados) — naturezas ambíguas
  // por si só (empréstimo, ajuste, não classificado) ficam sem filtro.
  const categoryKind = nature ? categoryKindForNature(nature) : null;
  const parentCategories = useMemo(
    () => sortByName(categories.filter((c) => !c.parent_id && (!categoryKind || c.kind === categoryKind))),
    [categories, categoryKind],
  );
  const subcategories = useMemo(
    () => sortByName(categories.filter((c) => c.parent_id === categoryChoice)),
    [categories, categoryChoice],
  );

  const tagResults = useMemo(() => {
    const query = tagSearch.trim().toLowerCase();
    if (!query) return [];
    return sortByName(localTags.filter((t) => !selectedTagNames.includes(t.name) && t.name.toLowerCase().includes(query)));
  }, [localTags, tagSearch, selectedTagNames]);
  const hasExactTagMatch = localTags.some((t) => t.name.toLowerCase() === tagSearch.trim().toLowerCase());

  const hasChanges =
    Boolean(nature) ||
    categoryChoice !== KEEP_CATEGORY ||
    selectedTagNames.length > 0 ||
    description.trim().length > 0 ||
    counterparty.trim().length > 0 ||
    notes.trim().length > 0;

  function changeNature(next: TransactionNature | "") {
    const nextKind = next ? categoryKindForNature(next) : null;
    if (nextKind && hasRealCategory) {
      const current = categories.find((c) => c.id === categoryChoice);
      if (current && current.kind !== nextKind) {
        setCategoryChoice(KEEP_CATEGORY);
        setSubcategoryId("");
      }
    }
    setNature(next);
  }

  function handleCreateTag() {
    const name = tagSearch.trim();
    if (!name || hasExactTagMatch) return;
    const fd = new FormData();
    fd.set("name", name);
    fd.set("color", TAG_COLORS[localTags.length % TAG_COLORS.length]);
    startCreateTagTransition(async () => {
      const result = await createTagAction(spaceId, {}, fd);
      if (result.error || !result.tag) {
        toast.error(result.error ?? "Não foi possível criar a tag.");
        return;
      }
      setLocalTags((prev) => [...prev, result.tag!]);
      setSelectedTagNames((prev) => [...prev, result.tag!.name]);
      setTagSearch("");
      toast.success("Tag criada");
    });
  }

  function handleSubmit() {
    startTransition(async () => {
      const result = await bulkUpdateCategoryAction(spaceId, {
        transactionIds,
        ...(categoryChoice === KEEP_CATEGORY
          ? {}
          : { categoryId: categoryChoice === CLEAR_CATEGORY ? null : categoryChoice, subcategoryId: subcategoryId || null }),
        nature: nature || null,
        addTags: selectedTagNames,
        description: description.trim() || undefined,
        counterparty: counterparty.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`Classificação alterada em ${transactionIds.length} lançamento(s)`);
      setOpen(false);
      setNature("");
      setCategoryChoice(KEEP_CATEGORY);
      setSubcategoryId("");
      setSelectedTagNames([]);
      setTagSearch("");
      setDescription("");
      setCounterparty("");
      setNotes("");
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
            Aplica natureza, categoria e tags aos {transactionIds.length} lançamentos selecionados. Campos em
            &quot;Não alterar&quot; ficam como estão.
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
                value={categoryChoice}
                onValueChange={(v) => {
                  setCategoryChoice(v);
                  setSubcategoryId("");
                }}
              >
                <SelectTrigger id="bulk-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={KEEP_CATEGORY}>Não alterar categoria</SelectItem>
                  <SelectItem value={CLEAR_CATEGORY}>Remover categoria</SelectItem>
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
              <Select value={subcategoryId} onValueChange={setSubcategoryId} disabled={!hasRealCategory}>
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

          <div>
            <Label>Adicionar tags</Label>
            <p className="mb-1.5 -mt-0.5 text-[11px] text-text-tertiary">
              As tags escolhidas são acrescentadas aos lançamentos selecionados, sem remover as que eles já têm.
            </p>

            {selectedTagNames.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {selectedTagNames.map((name) => {
                  const color = localTags.find((t) => t.name === name)?.color ?? "#94a3b8";
                  return (
                    <span
                      key={name}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px]"
                      style={{ backgroundColor: `${color}26`, color }}
                    >
                      {name}
                      <button
                        type="button"
                        onClick={() => setSelectedTagNames((prev) => prev.filter((n) => n !== name))}
                        aria-label={`Remover tag ${name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </div>
            ) : null}

            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
              <Input value={tagSearch} onChange={(e) => setTagSearch(e.target.value)} placeholder="Buscar ou criar uma tag…" className="pl-8" />
            </div>
            {tagSearch.trim() ? (
              <div className="relative">
                <div className="absolute z-10 mt-1 w-full rounded-[var(--radius-md)] border border-border bg-surface-overlay shadow-[var(--shadow-md)]">
                  {tagResults.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTagNames((prev) => [...prev, t.name]);
                        setTagSearch("");
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-surface-sunken"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </button>
                  ))}
                  {!hasExactTagMatch ? (
                    <button
                      type="button"
                      onClick={handleCreateTag}
                      disabled={isCreatingTag}
                      className="flex w-full items-center gap-1 border-t border-border-subtle px-3 py-2 text-left text-[13px] text-accent hover:bg-surface-sunken"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {isCreatingTag ? "Criando…" : `Criar tag "${tagSearch.trim()}"`}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="bulk-description">Descrição</Label>
              <Input
                id="bulk-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
                placeholder="Em branco = não alterar; preenchida, substitui a descrição dos selecionados"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="bulk-counterparty">Estabelecimento / contraparte</Label>
              <Input
                id="bulk-counterparty"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="Em branco = não alterar"
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="bulk-notes">Observações</Label>
              <Textarea
                id="bulk-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Em branco = não alterar; preenchido, substitui as observações dos selecionados"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">
              Cancelar
            </Button>
          </DialogClose>
          <Button variant="primary" onClick={handleSubmit} disabled={isPending || !hasChanges}>
            {isPending ? "Salvando…" : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
