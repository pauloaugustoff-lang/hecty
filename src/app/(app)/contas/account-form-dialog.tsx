"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { createAccountAction, updateAccountAction, type ActionState } from "./actions";
import type { AccountRow } from "@/lib/data/accounts";
import { accountTypeLabels } from "@/lib/domain/labels";
import { parseBRLToCents, formatCents, CURRENCIES, CURRENCY_LABELS, type CurrencyCode } from "@/lib/money/money";
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const ACCOUNT_COLORS = ["#0b1d3a", "#1e4db7", "#109b7e", "#5c4b87", "#b7791f", "#5b6472"];

const initialState: ActionState = {};

export function AccountFormDialog({ spaceId, account }: { spaceId: string; account?: AccountRow }) {
  const isEdit = Boolean(account);
  const [open, setOpen] = useState(false);
  const boundAction = isEdit
    ? updateAccountAction.bind(null, account!.id, spaceId)
    : createAccountAction.bind(null, spaceId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const [type, setType] = useState(account?.type ?? "corrente");
  const [color, setColor] = useState(account?.color ?? ACCOUNT_COLORS[0]);
  const [currency, setCurrency] = useState<CurrencyCode>((account?.currency as CurrencyCode) ?? "BRL");
  const [balanceInput, setBalanceInput] = useState(
    account ? formatCents(account.initial_balance_cents, account.currency).replace(/[^\d,.-]/g, "").trim() : "",
  );

  useEffect(() => {
    if (state.success) {
      toast.success(isEdit ? "Conta atualizada" : "Conta criada");
      setOpen(false);
    }
  }, [state.success, isEdit]);

  let initialBalanceCents = 0;
  try {
    initialBalanceCents = balanceInput ? parseBRLToCents(balanceInput) : 0;
  } catch {
    initialBalanceCents = 0;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm" aria-label={`Editar ${account?.name}`}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        ) : (
          <Button variant="primary">
            <Plus className="h-4 w-4" /> Nova conta
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar conta" : "Nova conta"}</DialogTitle>
          <DialogDescription>Contas representam onde o seu dinheiro está guardado.</DialogDescription>
        </DialogHeader>

        {state.error ? (
          <Callout tone="danger" className="mb-4">
            {state.error}
          </Callout>
        ) : null}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="color" value={color} />
          <input type="hidden" name="initialBalanceCents" value={initialBalanceCents} />

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" required defaultValue={account?.name} placeholder="Conta corrente Itaú" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="institution">Instituição</Label>
              <Input id="institution" name="institution" defaultValue={account?.institution} placeholder="Itaú" />
            </div>
            <div>
              <Label htmlFor="type">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)} name="type">
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(accountTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="type" value={type} />
            </div>
            {isEdit ? (
              <input type="hidden" name="currency" value={account!.currency} />
            ) : (
              <div>
                <Label htmlFor="currency">Moeda</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)} name="currency">
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CURRENCY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="currency" value={currency} />
              </div>
            )}
            <div>
              <Label htmlFor="initialBalanceDate">Data do saldo inicial</Label>
              <Input
                id="initialBalanceDate"
                name="initialBalanceDate"
                type="date"
                required
                defaultValue={account?.initial_balance_date ?? new Date().toISOString().slice(0, 10)}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="initialBalance">Saldo inicial ({isEdit ? account!.currency : currency})</Label>
              <Input
                id="initialBalance"
                inputMode="decimal"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="col-span-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                {ACCOUNT_COLORS.map((c) => (
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
