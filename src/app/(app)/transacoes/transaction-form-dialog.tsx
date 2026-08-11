"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { createTransactionAction, updateTransactionAction, type ActionState } from "./actions";
import type { TransactionWithRelations } from "@/lib/data/transactions";
import type { AccountRow } from "@/lib/data/accounts";
import type { CardRow } from "@/lib/data/cards";
import type { CategoryRow } from "@/lib/data/categories";
import type { TransactionNature, TransactionDirection } from "@/lib/supabase/types";
import { natureLabels } from "@/lib/domain/labels";
import { parseBRLToCents, formatCentsToBRL } from "@/lib/money/money";
import { getStatementPeriod } from "@/lib/transactions/cards";
import { format } from "date-fns";
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup } from "@/components/ui/select";
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

  const isRedemption = nature === "resgate_investimento" || nature === "resgate_a_decompor";
  const parentCategories = useMemo(() => categories.filter((c) => !c.parent_id), [categories]);
  const subcategories = useMemo(
    () => categories.filter((c) => c.parent_id === categoryId),
    [categories, categoryId],
  );

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

            {!isRedemption && (
              <>
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
