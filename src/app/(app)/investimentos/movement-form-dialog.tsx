"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { createMovementAction, updateMovementAction, type ActionState } from "./actions";
import type { AccountRow } from "@/lib/data/accounts";
import type { InvestmentAssetRow, InvestmentMovementRow, InvestmentMovementType } from "@/lib/supabase/types";
import { movementCashDirection, movementTypeLabels, QUANTITY_MOVEMENT_TYPES } from "@/lib/investments/labels";
import { parseToCents, formatCents, currencyDecimals } from "@/lib/money/money";
import { sortByName } from "@/lib/utils/sort";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const initialState: ActionState = {};

function centsToInput(cents: number | null | undefined, currency: string): string {
  if (cents === null || cents === undefined) return "";
  return formatCents(cents, currency)
    .replace(/[^\d,.-]/g, "")
    .trim();
}

function toCents(input: string, currency: string): number {
  if (!input.trim()) return 0;
  try {
    return parseToCents(input, currency);
  } catch {
    return 0;
  }
}

function toNumber(input: string): number {
  const value = Number(input.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(value) ? value : 0;
}

export function MovementFormDialog({
  spaceId,
  assets,
  accounts,
  movement,
  defaultAssetId,
  trigger,
}: {
  spaceId: string;
  assets: InvestmentAssetRow[];
  accounts: AccountRow[];
  movement?: InvestmentMovementRow;
  defaultAssetId?: string;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(movement);
  const [open, setOpen] = useState(false);
  const boundAction = isEdit
    ? updateMovementAction.bind(null, movement!.id, spaceId)
    : createMovementAction.bind(null, spaceId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);

  const [assetId, setAssetId] = useState(movement?.asset_id ?? defaultAssetId ?? assets[0]?.id ?? "");
  const [movementType, setMovementType] = useState<InvestmentMovementType>(movement?.movement_type ?? "aporte");
  const [createTransactionAccountId, setCreateTransactionAccountId] = useState("");

  const asset = useMemo(() => assets.find((a) => a.id === assetId), [assets, assetId]);
  const currency = asset?.currency ?? "BRL";

  const [quantityInput, setQuantityInput] = useState(movement ? String(movement.quantity ?? "") : "");
  const [unitPriceInput, setUnitPriceInput] = useState(centsToInput(movement?.unit_price_cents, currency));
  const [amountInput, setAmountInput] = useState(centsToInput(movement?.amount_cents, currency));
  const [amountTouched, setAmountTouched] = useState(isEdit);
  const [feesInput, setFeesInput] = useState(centsToInput(movement?.fees_cents, currency));
  const [taxInput, setTaxInput] = useState(centsToInput(movement?.tax_cents, currency));
  const [splitFactorInput, setSplitFactorInput] = useState(movement?.split_factor ? String(movement.split_factor) : "");

  useEffect(() => {
    if (state.success) {
      toast.success(isEdit ? "Movimento atualizado" : "Movimento registrado");
      setOpen(false);
    }
  }, [state, isEdit]);

  const usesQuantity = QUANTITY_MOVEMENT_TYPES.includes(movementType) && movementType !== "desdobramento";
  const isSplit = movementType === "desdobramento";
  const cashDirection = movementCashDirection(movementType);

  /**
   * Quantidade x preço unitário preenche o valor total sozinho — é assim que a
   * nota de corretagem se lê. Assim que a pessoa digita no total, ela assume o
   * controle e o cálculo para de sobrescrever (corretora arredonda, e o total
   * da nota é que é verdade).
   */
  const derivedAmountCents = useMemo(() => {
    const quantity = toNumber(quantityInput);
    const unitPrice = toCents(unitPriceInput, currency);
    if (quantity <= 0 || unitPrice <= 0) return null;
    return Math.round(quantity * unitPrice);
  }, [quantityInput, unitPriceInput, currency]);

  useEffect(() => {
    if (amountTouched || derivedAmountCents === null) return;
    setAmountInput(centsToInput(derivedAmountCents, currency));
  }, [derivedAmountCents, amountTouched, currency]);

  const amountCents = toCents(amountInput, currency);
  const quantityValue = toNumber(quantityInput);

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
              <Plus className="h-4 w-4" /> Novo movimento
            </Button>
          ))}
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar movimento" : "Novo movimento"}</DialogTitle>
          <DialogDescription>
            Aportes, resgates e proventos do ativo. É daqui que sai a posição e a rentabilidade.
          </DialogDescription>
        </DialogHeader>

        {state.error ? (
          <Callout tone="danger" className="mb-4">
            {state.error}
          </Callout>
        ) : null}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="assetId" value={assetId} />
          <input type="hidden" name="movementType" value={movementType} />
          <input type="hidden" name="amountCents" value={amountCents} />
          <input type="hidden" name="feesCents" value={toCents(feesInput, currency)} />
          <input type="hidden" name="taxCents" value={toCents(taxInput, currency)} />
          <input type="hidden" name="quantity" value={usesQuantity ? quantityValue : 0} />
          <input
            type="hidden"
            name="unitPriceCents"
            value={usesQuantity && unitPriceInput ? toCents(unitPriceInput, currency) : ""}
          />
          {isSplit ? <input type="hidden" name="splitFactor" value={toNumber(splitFactorInput)} /> : null}
          {!isEdit && createTransactionAccountId ? (
            <input type="hidden" name="createTransactionAccountId" value={createTransactionAccountId} />
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="movement-asset">Ativo</Label>
              <Select value={assetId} onValueChange={setAssetId} disabled={Boolean(defaultAssetId) || isEdit}>
                <SelectTrigger id="movement-asset">
                  <SelectValue placeholder="Escolha o ativo" />
                </SelectTrigger>
                <SelectContent>
                  {sortByName(assets).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      {a.ticker ? ` · ${a.ticker}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="movement-type">Tipo</Label>
              <Select value={movementType} onValueChange={(v) => setMovementType(v as InvestmentMovementType)}>
                <SelectTrigger id="movement-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(movementTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="movement-date">Data</Label>
              <Input
                id="movement-date"
                name="movementDate"
                type="date"
                required
                defaultValue={movement?.movement_date ?? new Date().toISOString().slice(0, 10)}
              />
            </div>

            {isSplit ? (
              <div className="col-span-2">
                <Label htmlFor="movement-split">Fator</Label>
                <Input
                  id="movement-split"
                  inputMode="decimal"
                  value={splitFactorInput}
                  onChange={(e) => setSplitFactorInput(e.target.value)}
                  placeholder="10 para um desdobramento 1:10; 0,1 para um grupamento 10:1"
                />
              </div>
            ) : null}

            {usesQuantity ? (
              <>
                <div>
                  <Label htmlFor="movement-quantity">Quantidade</Label>
                  <Input
                    id="movement-quantity"
                    inputMode="decimal"
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                    placeholder="100"
                  />
                </div>
                <div>
                  <Label htmlFor="movement-unit-price">Preço unitário ({currency})</Label>
                  <Input
                    id="movement-unit-price"
                    inputMode="decimal"
                    value={unitPriceInput}
                    onChange={(e) => setUnitPriceInput(e.target.value)}
                    placeholder={(0).toFixed(currencyDecimals(currency)).replace(".", ",")}
                  />
                </div>
              </>
            ) : null}

            {!isSplit ? (
              <>
                <div>
                  <Label htmlFor="movement-amount">Valor total ({currency})</Label>
                  <Input
                    id="movement-amount"
                    inputMode="decimal"
                    value={amountInput}
                    onChange={(e) => {
                      setAmountTouched(true);
                      setAmountInput(e.target.value);
                    }}
                    placeholder="0,00"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="movement-fees">Taxas</Label>
                    <Input
                      id="movement-fees"
                      inputMode="decimal"
                      value={feesInput}
                      onChange={(e) => setFeesInput(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <Label htmlFor="movement-tax">Imposto</Label>
                    <Input
                      id="movement-tax"
                      inputMode="decimal"
                      value={taxInput}
                      onChange={(e) => setTaxInput(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </>
            ) : null}

            <div className="col-span-2">
              <Label htmlFor="movement-notes">Observações</Label>
              <Textarea id="movement-notes" name="notes" rows={2} defaultValue={movement?.notes} />
            </div>

            {!isEdit && cashDirection && !movement?.transaction_id ? (
              <div className="col-span-2 rounded-[var(--radius-md)] border border-accent/30 bg-accent-soft/40 p-3">
                <Label htmlFor="movement-create-transaction">Lançar também em Transações</Label>
                <Select value={createTransactionAccountId} onValueChange={setCreateTransactionAccountId}>
                  <SelectTrigger id="movement-create-transaction">
                    <SelectValue placeholder="Não lançar — o extrato já tem esse movimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortByName(accounts).map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-[11px] text-text-tertiary">
                  Escolha a conta só se este dinheiro ainda não está lançado. Se ele veio do extrato importado, deixe em
                  branco e vincule o lançamento pela carteira — senão o valor conta duas vezes.
                </p>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" disabled={isPending || !assetId}>
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
