"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Pencil, X, Search } from "lucide-react";
import { toast } from "sonner";
import {
  createTransactionAction,
  updateTransactionAction,
  searchExpenseTransactionsAction,
  type ActionState,
  type ExpenseSearchResult,
} from "./actions";
import { createCategoryAction } from "../configuracoes/categorias/actions";
import type { TransactionWithRelations } from "@/lib/data/transactions";
import type { AccountRow } from "@/lib/data/accounts";
import type { CardRow } from "@/lib/data/cards";
import type { CategoryRow } from "@/lib/data/categories";
import type { TransactionNature, TransactionDirection, CategoryKind } from "@/lib/supabase/types";
import { natureLabels } from "@/lib/domain/labels";
import { parseBRLToCents, formatCentsToBRL } from "@/lib/money/money";
import { getStatementPeriod } from "@/lib/transactions/cards";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectSeparator } from "@/components/ui/select";
import { cn } from "@/lib/utils/cn";

const GENERIC_NATURES: TransactionNature[] = [
  "receita_trabalho",
  "rendimento_investimento",
  "outras_receitas",
  "despesa",
  "aplicacao_financeira",
  "resgate_investimento",
  "resgate_a_decompor",
  "estorno",
  "reembolso",
  "emprestimo",
  "ajuste",
  "nao_classificado",
];

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

export function TransactionFormDialog({
  spaceId,
  accounts,
  cards,
  categories,
  transaction,
  trigger,
}: {
  spaceId: string;
  accounts: AccountRow[];
  cards: CardRow[];
  categories: CategoryRow[];
  transaction?: TransactionWithRelations;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(transaction);
  const [open, setOpen] = useState(false);
  const boundAction = isEdit
    ? updateTransactionAction.bind(null, transaction!.id, spaceId)
    : createTransactionAction.bind(null, spaceId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);

  const [direction, setDirection] = useState<TransactionDirection>(transaction?.direction ?? "saida");
  const [nature, setNature] = useState<TransactionNature>(transaction?.nature ?? "despesa");
  const [source, setSource] = useState(
    transaction?.account_id ? `account:${transaction.account_id}` : transaction?.card_id ? `card:${transaction.card_id}` : "",
  );
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? "");
  const [subcategoryId, setSubcategoryId] = useState(transaction?.subcategory_id ?? "");
  const [amountInput, setAmountInput] = useState(
    transaction ? formatCentsToBRL(transaction.amount_cents).replace("R$", "").trim() : "",
  );
  const [movementDate, setMovementDate] = useState(transaction?.movement_date ?? new Date().toISOString().slice(0, 10));
  const [competenceDate, setCompetenceDate] = useState(transaction?.competence_date ?? "");
  // Ao editar, respeita o valor já persistido em vez de recalcular e
  // sobrescrever silenciosamente assim que o diálogo abre.
  const [competenceDateTouched, setCompetenceDateTouched] = useState(Boolean(transaction));

  const [linkedExpenses, setLinkedExpenses] = useState<
    { id: string; original_description: string; amount_cents: number; movement_date: string }[]
  >(
    () =>
      (transaction?.reimbursement_links ?? [])
        .map((l) => l.expense)
        .filter((e): e is { id: string; original_description: string; amount_cents: number; movement_date: string } => Boolean(e)),
  );
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseResults, setExpenseResults] = useState<ExpenseSearchResult[]>([]);
  const [isSearchingExpense, setIsSearchingExpense] = useState(false);

  const [localCategories, setLocalCategories] = useState<CategoryRow[]>(categories);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryKind, setNewCategoryKind] = useState<CategoryKind>("despesa");
  const [newCategoryColor, setNewCategoryColor] = useState(CATEGORY_COLORS[0]);
  const [creatingSubcategory, setCreatingSubcategory] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [newSubcategoryColor, setNewSubcategoryColor] = useState(CATEGORY_COLORS[0]);
  const [isCreatingCategory, startCreateCategoryTransition] = useTransition();

  const isRedemption = nature === "resgate_investimento" || nature === "resgate_a_decompor";
  const isReimbursing = nature === "reembolso" || nature === "estorno";
  const linkedExpensesTotal = linkedExpenses.reduce((sum, e) => sum + e.amount_cents, 0);
  const parentCategories = useMemo(() => localCategories.filter((c) => !c.parent_id), [localCategories]);
  const subcategories = useMemo(
    () => localCategories.filter((c) => c.parent_id === categoryId),
    [localCategories, categoryId],
  );
  const selectedParentCategory = useMemo(() => localCategories.find((c) => c.id === categoryId), [localCategories, categoryId]);

  function suggestedCategoryKind(): CategoryKind {
    if (nature === "aplicacao_financeira" || nature === "resgate_investimento" || nature === "resgate_a_decompor") return "investimento";
    if (direction === "entrada") return "receita";
    return "despesa";
  }

  const [accountId, cardId] = source.startsWith("account:")
    ? [source.slice(8), ""]
    : source.startsWith("card:")
      ? ["", source.slice(5)]
      : ["", ""];
  const selectedCard = cards.find((c) => c.id === cardId);

  // Compra no cartão: sugere automaticamente a data de vencimento da fatura
  // (quando o dinheiro sai da conta) a partir do ciclo do cartão. O usuário
  // pode sobrescrever; uma vez editado manualmente, para de recalcular.
  useEffect(() => {
    if (!selectedCard || !movementDate || competenceDateTouched) return;
    const dueDate = getStatementPeriod(selectedCard.closing_day, selectedCard.due_day, new Date(`${movementDate}T00:00:00`)).dueDate;
    setCompetenceDate(format(dueDate, "yyyy-MM-dd"));
  }, [selectedCard, movementDate, competenceDateTouched]);

  useEffect(() => {
    if (!isReimbursing || !expenseSearch.trim()) {
      setExpenseResults([]);
      return;
    }
    setIsSearchingExpense(true);
    const timeout = setTimeout(() => {
      searchExpenseTransactionsAction(spaceId, expenseSearch)
        .then(setExpenseResults)
        .finally(() => setIsSearchingExpense(false));
    }, 300);
    return () => clearTimeout(timeout);
  }, [isReimbursing, expenseSearch, spaceId]);

  useEffect(() => {
    if (state.success) {
      toast.success(isEdit ? "Lançamento atualizado" : "Lançamento criado");
      setOpen(false);
    }
  }, [state.success, isEdit]);

  let amountCents = 0;
  try {
    amountCents = amountInput ? parseBRLToCents(amountInput) : 0;
  } catch {
    amountCents = 0;
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ??
          (isEdit ? (
            <Button variant="ghost" size="sm">
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
          ) : (
            <Button variant="primary">
              <Plus className="h-4 w-4" /> Novo lançamento
            </Button>
          ))}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar lançamento" : "Novo lançamento"}</DialogTitle>
        </DialogHeader>

        {state.error ? (
          <Callout tone="danger" className="mb-4">
            {state.error}
          </Callout>
        ) : null}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="amountCents" value={amountCents} />
          <input type="hidden" name="direction" value={direction} />
          <input type="hidden" name="nature" value={nature} />
          <input type="hidden" name="accountId" value={accountId} />
          <input type="hidden" name="cardId" value={cardId} />
          <input type="hidden" name="categoryId" value={categoryId} />
          <input type="hidden" name="subcategoryId" value={subcategoryId} />
          {linkedExpenses.map((e) => (
            <input key={e.id} type="hidden" name="linkedExpenseIds" value={e.id} />
          ))}

          <div className="flex gap-1 rounded-[var(--radius-md)] border border-border p-1">
            {(["saida", "entrada"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={cn(
                  "flex-1 rounded-[var(--radius-sm)] py-1.5 text-sm font-medium transition-colors",
                  direction === d ? (d === "saida" ? "bg-negative-soft text-negative" : "bg-positive-soft text-positive") : "text-text-tertiary",
                )}
              >
                {d === "saida" ? "Saída" : "Entrada"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                name="description"
                required
                defaultValue={transaction?.original_description}
                placeholder="Ex.: Supermercado BH"
              />
            </div>
            <div>
              <Label htmlFor="amount">Valor</Label>
              <Input id="amount" inputMode="decimal" required value={amountInput} onChange={(e) => setAmountInput(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label htmlFor="movementDate">{selectedCard ? "Data da compra" : "Data"}</Label>
              <Input
                id="movementDate"
                name="movementDate"
                type="date"
                required
                value={movementDate}
                onChange={(e) => setMovementDate(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="source">Conta ou cartão</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger id="source">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={`account:${a.id}`}>
                        {a.name}
                      </SelectItem>
                    ))}
                    {cards.map((c) => (
                      <SelectItem key={c.id} value={`card:${c.id}`}>
                        {c.name} (cartão)
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {selectedCard ? (
              <div className="col-span-2">
                <Label htmlFor="competenceDate">Data que sai da conta (vencimento da fatura)</Label>
                <Input
                  id="competenceDate"
                  name="competenceDate"
                  type="date"
                  required
                  value={competenceDate}
                  onChange={(e) => {
                    setCompetenceDate(e.target.value);
                    setCompetenceDateTouched(true);
                  }}
                />
                <p className="mt-1 text-[11px] text-text-tertiary">
                  Calculada a partir do ciclo do cartão — conta como despesa neste mês, não no mês da compra.
                </p>
              </div>
            ) : null}
            <div className="col-span-2">
              <Label htmlFor="nature">Natureza</Label>
              <Select value={nature} onValueChange={(v) => setNature(v as TransactionNature)}>
                <SelectTrigger id="nature">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENERIC_NATURES.map((n) => (
                    <SelectItem key={n} value={n}>
                      {natureLabels[n]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isReimbursing ? (
              <div className="col-span-2">
                <Label>{nature === "estorno" ? "Qual(is) despesa(s) isso estorna?" : "Qual(is) despesa(s) isso reembolsa?"}</Label>

                {linkedExpenses.length > 0 ? (
                  <div className="mb-2 space-y-1.5">
                    {linkedExpenses.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-center justify-between rounded-[var(--radius-sm)] border border-border bg-surface-raised px-3 py-2 text-sm"
                      >
                        <span className="text-text-primary">
                          {e.original_description}
                          <span className="text-text-tertiary"> · {format(new Date(`${e.movement_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}</span>
                          {" — "}
                          {formatCentsToBRL(e.amount_cents)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setLinkedExpenses((prev) => prev.filter((x) => x.id !== e.id))}
                          aria-label={`Remover vínculo com ${e.original_description}`}
                          className="text-text-tertiary hover:text-text-primary"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
                  <Input
                    value={expenseSearch}
                    onChange={(e) => setExpenseSearch(e.target.value)}
                    placeholder="Buscar mais uma despesa pela descrição…"
                    className="pl-8"
                  />
                </div>
                {expenseSearch.trim() ? (
                  <div className="relative">
                    <div className="absolute z-10 mt-1 w-full rounded-[var(--radius-md)] border border-border bg-surface-overlay shadow-[var(--shadow-md)]">
                      {isSearchingExpense ? (
                        <p className="px-3 py-2 text-[13px] text-text-tertiary">Buscando…</p>
                      ) : expenseResults.filter((r) => !linkedExpenses.some((e) => e.id === r.id)).length === 0 ? (
                        <p className="px-3 py-2 text-[13px] text-text-tertiary">Nenhuma despesa encontrada.</p>
                      ) : (
                        expenseResults
                          .filter((r) => !linkedExpenses.some((e) => e.id === r.id))
                          .map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                setLinkedExpenses((prev) => [
                                  ...prev,
                                  { id: r.id, original_description: r.originalDescription, amount_cents: r.amountCents, movement_date: r.movementDate },
                                ]);
                                setExpenseSearch("");
                                setExpenseResults([]);
                              }}
                              className="flex w-full items-center justify-between px-3 py-2 text-left text-[13px] hover:bg-surface-sunken"
                            >
                              <span>
                                {r.originalDescription}
                                <span className="text-text-tertiary">
                                  {" · "}
                                  {format(new Date(`${r.movementDate}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                                  {r.categoryName ? ` · ${r.categoryName}` : ""}
                                </span>
                              </span>
                              <span className="tabular text-text-secondary">{formatCentsToBRL(r.amountCents)}</span>
                            </button>
                          ))
                      )}
                    </div>
                  </div>
                ) : null}

                <p className="mt-1.5 text-[11px] text-text-tertiary">
                  O valor deste lançamento é distribuído entre as despesas selecionadas (proporcional ao valor de
                  cada uma) e abatido daquela categoria — não fica só contando como receita à parte. Cobre tanto
                  reembolso parcial (ex.: estorno de metade de uma mensalidade) quanto um pagamento cobrindo várias
                  despesas de uma vez.
                </p>
                {linkedExpenses.length > 0 && amountCents > 0 && linkedExpensesTotal !== amountCents ? (
                  <Callout tone="warning" className="mt-2">
                    Despesas selecionadas somam {formatCentsToBRL(linkedExpensesTotal)}, mas este lançamento é de{" "}
                    {formatCentsToBRL(amountCents)}. Confira se está certo.
                  </Callout>
                ) : null}
              </div>
            ) : null}

            {!isRedemption && (
              <>
                <div>
                  <Label htmlFor="category">Categoria</Label>
                  <Select
                    value={categoryId}
                    onValueChange={(v) => {
                      if (v === NEW_CATEGORY_VALUE) {
                        setNewCategoryKind(suggestedCategoryKind());
                        setCreatingCategory(true);
                        return;
                      }
                      setCategoryId(v);
                      setSubcategoryId("");
                    }}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Sem categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {parentCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                      <SelectSeparator />
                      <SelectItem value={NEW_CATEGORY_VALUE}>+ Criar nova categoria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="subcategory">Subcategoria</Label>
                  <Select
                    value={subcategoryId}
                    onValueChange={(v) => {
                      if (v === NEW_CATEGORY_VALUE) {
                        setCreatingSubcategory(true);
                        return;
                      }
                      setSubcategoryId(v);
                    }}
                    disabled={!categoryId}
                  >
                    <SelectTrigger id="subcategory">
                      <SelectValue placeholder="Sem subcategoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {subcategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                      <SelectSeparator />
                      <SelectItem value={NEW_CATEGORY_VALUE}>+ Criar nova subcategoria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

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
              </>
            )}

            <div className="col-span-2">
              <Label htmlFor="counterparty">Estabelecimento / contraparte</Label>
              <Input id="counterparty" name="counterparty" defaultValue={transaction?.counterparty} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea id="notes" name="notes" defaultValue={transaction?.notes} rows={2} />
            </div>
          </div>

          {isRedemption ? (
            <RedemptionFields defaultValues={transaction?.redemption} totalAmountCents={amountCents} />
          ) : null}

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

function RedemptionFields({
  defaultValues,
  totalAmountCents,
}: {
  defaultValues?: TransactionWithRelations["redemption"];
  totalAmountCents: number;
}) {
  const [principal, setPrincipal] = useState(defaultValues ? centsToInput(defaultValues.principal_cents) : "");
  const [netYield, setNetYield] = useState(defaultValues ? centsToInput(defaultValues.net_yield_cents) : "");

  const principalCents = safeParse(principal);
  const netYieldCents = safeParse(netYield);
  const hasBoth = principalCents !== null && netYieldCents !== null;
  const discrepancy = hasBoth ? totalAmountCents - (principalCents! + netYieldCents!) : null;

  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border border-pending/40 bg-pending-soft/40 p-3.5">
      <p className="text-[13px] font-medium text-pending">Decomposição do resgate</p>
      <p className="text-[12px] text-text-secondary">
        Apenas o rendimento líquido conta como receita. O principal devolvido é retorno de capital, não receita.
        Deixe em branco se ainda não souber — o lançamento fica como &quot;resgate a decompor&quot;.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="principalCents">Principal devolvido</Label>
          <Input id="principalCents" inputMode="decimal" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="0,00" />
          <input type="hidden" name="principalCents" value={principalCents ?? ""} />
        </div>
        <div>
          <Label htmlFor="netYieldCents">Rendimento líquido</Label>
          <Input id="netYieldCents" inputMode="decimal" value={netYield} onChange={(e) => setNetYield(e.target.value)} placeholder="0,00" />
          <input type="hidden" name="netYieldCents" value={netYieldCents ?? ""} />
        </div>
        <div>
          <Label htmlFor="taxCents">Imposto retido</Label>
          <Input id="taxCents" name="taxCentsDisplay" inputMode="decimal" defaultValue={defaultValues ? centsToInput(defaultValues.tax_cents) : ""} onChange={(e) => syncHidden(e, "taxCents")} placeholder="0,00" />
          <input type="hidden" name="taxCents" defaultValue={defaultValues?.tax_cents ?? ""} />
        </div>
        <div>
          <Label htmlFor="feesCents">Taxas</Label>
          <Input id="feesCents" name="feesCentsDisplay" inputMode="decimal" defaultValue={defaultValues ? centsToInput(defaultValues.fees_cents) : ""} onChange={(e) => syncHidden(e, "feesCents")} placeholder="0,00" />
          <input type="hidden" name="feesCents" defaultValue={defaultValues?.fees_cents ?? ""} />
        </div>
        <div>
          <Label htmlFor="redemptionInstitution">Instituição</Label>
          <Input id="redemptionInstitution" name="redemptionInstitution" defaultValue={defaultValues?.institution} />
        </div>
        <div>
          <Label htmlFor="redemptionProduct">Produto</Label>
          <Input id="redemptionProduct" name="redemptionProduct" defaultValue={defaultValues?.product} placeholder="CDB, Tesouro..." />
        </div>
        <div>
          <Label htmlFor="applicationDate">Data da aplicação</Label>
          <Input id="applicationDate" name="applicationDate" type="date" defaultValue={defaultValues?.application_date ?? ""} />
        </div>
        <div>
          <Label htmlFor="redemptionDate">Data do resgate</Label>
          <Input id="redemptionDate" name="redemptionDate" type="date" defaultValue={defaultValues?.redemption_date ?? ""} />
        </div>
      </div>
      {hasBoth && discrepancy !== 0 ? (
        <Callout tone="warning">
          Principal + rendimento líquido não fecha com o valor total (diferença de {formatCentsToBRL(discrepancy ?? 0)}).
          Confira os valores.
        </Callout>
      ) : null}
    </div>
  );
}

function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return formatCentsToBRL(cents).replace("R$", "").trim();
}

function safeParse(value: string): number | null {
  if (!value) return null;
  try {
    return parseBRLToCents(value);
  } catch {
    return null;
  }
}

function syncHidden(e: React.ChangeEvent<HTMLInputElement>, hiddenName: string) {
  const form = e.target.form;
  if (!form) return;
  const hidden = form.elements.namedItem(hiddenName) as HTMLInputElement | null;
  if (hidden) hidden.value = String(safeParse(e.target.value) ?? "");
}
