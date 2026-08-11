"use client";

import { useActionState, useEffect, useMemo, useState, useTransition, type KeyboardEvent } from "react";
import { Plus, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { createRuleAction, updateRuleAction, type ActionState } from "./actions";
import { createCategoryAction } from "../configuracoes/categorias/actions";
import type { RuleRow } from "@/lib/data/rules";
import type { AccountRow } from "@/lib/data/accounts";
import type { CardRow } from "@/lib/data/cards";
import type { CategoryRow } from "@/lib/data/categories";
import type { TransactionNature, RuleMatchType, TransactionDirection, CategoryKind } from "@/lib/supabase/types";
import { natureLabels } from "@/lib/domain/labels";
import { parseBRLToCents, formatCentsToBRL } from "@/lib/money/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectSeparator } from "@/components/ui/select";

const MATCH_TYPE_LABELS: Record<RuleMatchType, string> = {
  contem: "contém",
  comeca_com: "começa com",
  termina_com: "termina com",
  exato: "é exatamente",
  regex: "expressão regular (avançado)",
};

const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = {
  despesa: "Despesa",
  receita: "Receita",
  investimento: "Investimento",
  transferencia: "Transferência",
  outro: "Outro",
};

const CATEGORY_COLORS = ["#f97316", "#0ea5e9", "#8b5cf6", "#22c55e", "#14b8a6", "#ec4899", "#6366f1", "#94a3b8"];
const NEW_CATEGORY_VALUE = "__new__";

const initialState: ActionState = {};

export function RuleFormDialog({
  spaceId,
  userId,
  accounts,
  cards,
  categories,
  rule,
}: {
  spaceId: string;
  userId: string;
  accounts: AccountRow[];
  cards: CardRow[];
  categories: CategoryRow[];
  rule?: RuleRow;
}) {
  const isEdit = Boolean(rule);
  const [open, setOpen] = useState(false);
  const boundAction = isEdit
    ? updateRuleAction.bind(null, rule!.id, spaceId, userId)
    : createRuleAction.bind(null, spaceId, userId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);

  const [matchType, setMatchType] = useState<RuleMatchType>(rule?.match_type ?? "contem");
  const [matchValues, setMatchValues] = useState<string[]>(rule?.match_values ?? []);
  const [matchValueDraft, setMatchValueDraft] = useState("");
  const [direction, setDirection] = useState<TransactionDirection | "">(rule?.direction ?? "");
  const [sourceAccountId, setSourceAccountId] = useState(rule?.source_account_id ?? "");
  const [sourceCardId, setSourceCardId] = useState(rule?.source_card_id ?? "");
  const [actionNature, setActionNature] = useState<TransactionNature | "">(rule?.action_nature ?? "");
  const [categoryId, setCategoryId] = useState(rule?.action_category_id ?? "");
  const [subcategoryId, setSubcategoryId] = useState(rule?.action_subcategory_id ?? "");
  const [isActive, setIsActive] = useState(rule?.is_active ?? true);
  const [markTransfer, setMarkTransfer] = useState(rule?.action_mark_transfer ?? false);
  const [markRedemption, setMarkRedemption] = useState(rule?.action_mark_redemption ?? false);
  const [minInput, setMinInput] = useState(rule?.min_amount_cents ? formatCentsToBRL(rule.min_amount_cents).replace("R$", "").trim() : "");
  const [maxInput, setMaxInput] = useState(rule?.max_amount_cents ? formatCentsToBRL(rule.max_amount_cents).replace("R$", "").trim() : "");

  const [localCategories, setLocalCategories] = useState<CategoryRow[]>(categories);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryKind, setNewCategoryKind] = useState<CategoryKind>("despesa");
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [creatingSubcategory, setCreatingSubcategory] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [newSubcategoryColor, setNewSubcategoryColor] = useState(CATEGORY_COLORS[0]);
  const [isCreatingCategory, startCreateCategoryTransition] = useTransition();

  const parentCategories = useMemo(() => localCategories.filter((c) => !c.parent_id), [localCategories]);
  const subcategories = useMemo(() => localCategories.filter((c) => c.parent_id === categoryId), [localCategories, categoryId]);
  const selectedParentCategory = useMemo(() => localCategories.find((c) => c.id === categoryId), [localCategories, categoryId]);

  useEffect(() => {
    if (state.success) {
      toast.success(isEdit ? "Regra atualizada" : "Regra criada");
      setOpen(false);
    }
  }, [state.success, isEdit]);

  function addMatchValue(raw: string) {
    const value = raw.trim();
    if (!value) return;
    setMatchValues((prev) => (prev.includes(value) ? prev : [...prev, value]));
    setMatchValueDraft("");
  }

  function removeMatchValue(value: string) {
    setMatchValues((prev) => prev.filter((v) => v !== value));
  }

  function handleMatchValueKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addMatchValue(matchValueDraft);
    } else if (e.key === "Backspace" && !matchValueDraft && matchValues.length > 0) {
      removeMatchValue(matchValues[matchValues.length - 1]);
    }
  }

  function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    const fd = new FormData();
    fd.set("name", name);
    fd.set("kind", newCategoryKind);
    fd.set("color", newCategoryColor);
    startCreateCategoryTransition(async () => {
      const result = await createCategoryAction(spaceId, {}, fd);
      if (result.error || !result.category) {
        toast.error(result.error ?? "Não foi possível criar a categoria.");
        return;
      }
      setLocalCategories((prev) => [...prev, result.category!]);
      setCategoryId(result.category.id);
      setSubcategoryId("");
      setCreatingCategory(false);
      setNewCategoryName("");
      toast.success("Categoria criada");
    });
  }

  function handleCreateSubcategory() {
    const name = newSubcategoryName.trim();
    if (!name || !selectedParentCategory) return;
    const fd = new FormData();
    fd.set("name", name);
    fd.set("kind", selectedParentCategory.kind);
    fd.set("color", newSubcategoryColor);
    fd.set("parentId", selectedParentCategory.id);
    startCreateCategoryTransition(async () => {
      const result = await createCategoryAction(spaceId, {}, fd);
      if (result.error || !result.category) {
        toast.error(result.error ?? "Não foi possível criar a subcategoria.");
        return;
      }
      setLocalCategories((prev) => [...prev, result.category!]);
      setSubcategoryId(result.category.id);
      setCreatingSubcategory(false);
      setNewSubcategoryName("");
      toast.success("Subcategoria criada");
    });
  }

  function safeCents(v: string): number | null {
    if (!v) return null;
    try {
      return parseBRLToCents(v);
    } catch {
      return null;
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm">
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        ) : (
          <Button variant="primary">
            <Plus className="h-4 w-4" /> Nova regra
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar regra" : "Nova regra automática"}</DialogTitle>
        </DialogHeader>

        {state.error ? (
          <Callout tone="danger" className="mb-4">
            {state.error}
          </Callout>
        ) : null}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="isActive" value={String(isActive)} />
          <input type="hidden" name="matchType" value={matchType} />
          {matchValues.map((value) => (
            <input key={value} type="hidden" name="matchValues" value={value} />
          ))}
          {matchValueDraft.trim() && !matchValues.includes(matchValueDraft.trim()) ? (
            <input type="hidden" name="matchValues" value={matchValueDraft.trim()} />
          ) : null}
          <input type="hidden" name="direction" value={direction} />
          <input type="hidden" name="sourceAccountId" value={sourceAccountId} />
          <input type="hidden" name="sourceCardId" value={sourceCardId} />
          <input type="hidden" name="actionNature" value={actionNature} />
          <input type="hidden" name="actionCategoryId" value={categoryId} />
          <input type="hidden" name="actionSubcategoryId" value={subcategoryId} />
          <input type="hidden" name="actionMarkTransfer" value={String(markTransfer)} />
          <input type="hidden" name="actionMarkRedemption" value={String(markRedemption)} />
          <input type="hidden" name="minAmountCents" value={safeCents(minInput) ?? ""} />
          <input type="hidden" name="maxAmountCents" value={safeCents(maxInput) ?? ""} />

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Label htmlFor="name">Nome da regra</Label>
              <Input id="name" name="name" required defaultValue={rule?.name} placeholder="Ex.: Supermercado BH" />
            </div>
            <div className="ml-4 flex items-center gap-2 pt-5">
              <Switch checked={isActive} onCheckedChange={setIsActive} id="isActive" />
              <Label htmlFor="isActive" className="!mb-0">Ativa</Label>
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-border p-3.5">
            <p className="mb-3 text-[13px] font-medium text-text-secondary">Se a descrição...</p>
            <div className="grid grid-cols-3 gap-2">
              <Select value={matchType} onValueChange={(v) => setMatchType(v as RuleMatchType)}>
                <SelectTrigger className="col-span-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MATCH_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="col-span-2 flex min-h-9 flex-wrap items-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface-raised px-2 py-1.5">
                {matchValues.map((value) => (
                  <span
                    key={value}
                    className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[12px] text-accent"
                  >
                    {value}
                    <button type="button" onClick={() => removeMatchValue(value)} aria-label={`Remover "${value}"`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={matchValueDraft}
                  onChange={(e) => setMatchValueDraft(e.target.value)}
                  onKeyDown={handleMatchValueKeyDown}
                  onBlur={() => addMatchValue(matchValueDraft)}
                  placeholder={matchValues.length === 0 ? "texto ou padrão — Enter para adicionar mais" : "adicionar outra…"}
                  className="min-w-24 flex-1 bg-transparent text-sm text-text-primary outline-none placeholder:text-text-tertiary"
                />
              </div>
            </div>
            <p className="mt-1.5 text-[11px] text-text-tertiary">
              A regra casa se a descrição bater com qualquer uma das palavras-chave. Enter ou vírgula adiciona.
            </p>

            <p className="mb-2 mt-4 text-[13px] font-medium text-text-secondary">E, opcionalmente...</p>
            <div className="grid grid-cols-2 gap-2">
              <Select value={sourceAccountId || "any"} onValueChange={(v) => setSourceAccountId(v === "any" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer conta</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sourceCardId || "any"} onValueChange={(v) => setSourceCardId(v === "any" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer cartão" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Qualquer cartão</SelectItem>
                  {cards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={direction || "any"} onValueChange={(v) => setDirection(v === "any" ? "" : (v as TransactionDirection))}>
                <SelectTrigger>
                  <SelectValue placeholder="Entrada ou saída" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Entrada ou saída</SelectItem>
                  <SelectItem value="entrada">Somente entrada</SelectItem>
                  <SelectItem value="saida">Somente saída</SelectItem>
                </SelectContent>
              </Select>
              <div>
                <Label htmlFor="priority" className="!mb-1">Prioridade</Label>
                <Input id="priority" name="priority" type="number" min={1} max={1000} defaultValue={rule?.priority ?? 100} />
              </div>
              <div>
                <Label className="!mb-1">Valor mínimo</Label>
                <Input inputMode="decimal" value={minInput} onChange={(e) => setMinInput(e.target.value)} placeholder="0,00" />
              </div>
              <div>
                <Label className="!mb-1">Valor máximo</Label>
                <Input inputMode="decimal" value={maxInput} onChange={(e) => setMaxInput(e.target.value)} placeholder="0,00" />
              </div>
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-accent/30 bg-accent-soft/40 p-3.5">
            <p className="mb-3 text-[13px] font-medium text-accent">Então, classifique como...</p>
            <div className="grid grid-cols-2 gap-2">
              <Select value={actionNature || "none"} onValueChange={(v) => setActionNature(v === "none" ? "" : (v as TransactionNature))}>
                <SelectTrigger className="col-span-2">
                  <SelectValue placeholder="Natureza" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não alterar natureza</SelectItem>
                  {Object.entries(natureLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={categoryId || "none"}
                onValueChange={(v) => {
                  if (v === NEW_CATEGORY_VALUE) {
                    setCreatingCategory(true);
                    return;
                  }
                  setCategoryId(v === "none" ? "" : v);
                  setSubcategoryId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem categoria</SelectItem>
                  {parentCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={NEW_CATEGORY_VALUE}>+ Criar nova categoria</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={subcategoryId || "none"}
                onValueChange={(v) => {
                  if (v === NEW_CATEGORY_VALUE) {
                    setCreatingSubcategory(true);
                    return;
                  }
                  setSubcategoryId(v === "none" ? "" : v);
                }}
                disabled={!categoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Subcategoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem subcategoria</SelectItem>
                  {subcategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  <SelectItem value={NEW_CATEGORY_VALUE}>+ Criar nova subcategoria</SelectItem>
                </SelectContent>
              </Select>

              {creatingCategory ? (
                <div className="col-span-2 space-y-2 rounded-[var(--radius-sm)] border border-accent/40 bg-surface-raised p-3">
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Nome da nova categoria"
                      className="flex-1"
                    />
                    <Select value={newCategoryKind} onValueChange={(v) => setNewCategoryKind(v as CategoryKind)}>
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(CATEGORY_KIND_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    {CATEGORY_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewCategoryColor(c)}
                        className="h-5 w-5 rounded-full border-2 transition-transform"
                        style={{ backgroundColor: c, borderColor: newCategoryColor === c ? "var(--text-primary)" : "transparent" }}
                        aria-label={`Selecionar cor ${c}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCreatingCategory(false)}>
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleCreateCategory}
                      disabled={isCreatingCategory || !newCategoryName.trim()}
                    >
                      {isCreatingCategory ? "Criando…" : "Criar categoria"}
                    </Button>
                  </div>
                </div>
              ) : null}

              {creatingSubcategory && selectedParentCategory ? (
                <div className="col-span-2 space-y-2 rounded-[var(--radius-sm)] border border-accent/40 bg-surface-raised p-3">
                  <Input
                    autoFocus
                    value={newSubcategoryName}
                    onChange={(e) => setNewSubcategoryName(e.target.value)}
                    placeholder={`Nome da nova subcategoria de ${selectedParentCategory.name}`}
                  />
                  <div className="flex items-center gap-2">
                    {CATEGORY_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewSubcategoryColor(c)}
                        className="h-5 w-5 rounded-full border-2 transition-transform"
                        style={{ backgroundColor: c, borderColor: newSubcategoryColor === c ? "var(--text-primary)" : "transparent" }}
                        aria-label={`Selecionar cor ${c}`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setCreatingSubcategory(false)}>
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleCreateSubcategory}
                      disabled={isCreatingCategory || !newSubcategoryName.trim()}
                    >
                      {isCreatingCategory ? "Criando…" : "Criar subcategoria"}
                    </Button>
                  </div>
                </div>
              ) : null}

              <Input name="actionCounterparty" defaultValue={rule?.action_counterparty ?? ""} placeholder="Estabelecimento (opcional)" className="col-span-2" />
            </div>
            <div className="mt-3 flex gap-4">
              <label className="flex items-center gap-2 text-[13px] text-text-secondary">
                <Switch checked={markTransfer} onCheckedChange={setMarkTransfer} /> Marcar como transferência
              </label>
              <label className="flex items-center gap-2 text-[13px] text-text-secondary">
                <Switch checked={markRedemption} onCheckedChange={setMarkRedemption} /> Marcar como resgate
              </label>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "Salvando…" : "Salvar regra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
