"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { createTransferAction, type TransferActionState } from "./actions";
import type { AccountRow } from "@/lib/data/accounts";
import { parseBRLToCents, parseDecimalPtBR, formatCents } from "@/lib/money/money";
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

const initialState: TransferActionState = {};

export function TransferDialog({ spaceId, accounts }: { spaceId: string; accounts: AccountRow[] }) {
  const [open, setOpen] = useState(false);
  const boundAction = createTransferAction.bind(null, spaceId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [rateInput, setRateInput] = useState("");

  const fromCurrency = accounts.find((a) => a.id === fromAccountId)?.currency;
  const toCurrency = accounts.find((a) => a.id === toAccountId)?.currency;
  const isCrossCurrency = Boolean(fromCurrency && toCurrency && fromCurrency !== toCurrency);

  useEffect(() => {
    if (state.success) {
      toast.success("Transferência registrada");
      setOpen(false);
    }
  }, [state.success]);

  let amountCents = 0;
  try {
    amountCents = amountInput ? parseBRLToCents(amountInput) : 0;
  } catch {
    amountCents = 0;
  }

  let rate: number | null = null;
  try {
    rate = rateInput ? parseDecimalPtBR(rateInput) : null;
  } catch {
    rate = null;
  }
  const convertedCents = isCrossCurrency && rate && amountCents ? Math.round(amountCents * rate) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <ArrowLeftRight className="h-4 w-4" /> Transferência
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferência entre contas</DialogTitle>
          <DialogDescription>Gera duas movimentações ligadas; não conta como receita nem despesa.</DialogDescription>
        </DialogHeader>

        {state.error ? (
          <Callout tone="danger" className="mb-4">
            {state.error}
          </Callout>
        ) : null}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="fromAccountId" value={fromAccountId} />
          <input type="hidden" name="toAccountId" value={toAccountId} />
          <input type="hidden" name="amountCents" value={amountCents} />
          {isCrossCurrency ? <input type="hidden" name="exchangeRate" value={rateInput} /> : null}

          <div>
            <Label htmlFor="fromAccountId">De</Label>
            <Select value={fromAccountId} onValueChange={setFromAccountId}>
              <SelectTrigger id="fromAccountId">
                <SelectValue placeholder="Conta de origem" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="toAccountId">Para</Label>
            <Select value={toAccountId} onValueChange={setToAccountId}>
              <SelectTrigger id="toAccountId">
                <SelectValue placeholder="Conta de destino" />
              </SelectTrigger>
              <SelectContent>
                {accounts.filter((a) => a.id !== fromAccountId).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="amount">Valor {fromCurrency ? `(${fromCurrency})` : ""}</Label>
              <Input id="amount" inputMode="decimal" required value={amountInput} onChange={(e) => setAmountInput(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label htmlFor="movementDate">Data</Label>
              <Input id="movementDate" name="movementDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>

          {isCrossCurrency ? (
            <div className="rounded-[var(--radius-md)] border border-accent/30 bg-accent-soft/40 p-3">
              <Label htmlFor="exchangeRate">
                Cotação (1 {fromCurrency} = ? {toCurrency})
              </Label>
              <Input
                id="exchangeRate"
                inputMode="decimal"
                required
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                placeholder="Ex.: 5,20"
              />
              <p className="mt-1.5 text-[11px] text-text-secondary">
                {convertedCents !== null
                  ? `A conta de destino recebe ${formatCents(convertedCents, toCurrency)}.`
                  : "Informe a cotação usada nessa transferência para calcular quanto entra na conta de destino."}
              </p>
            </div>
          ) : null}

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" name="description" defaultValue="Transferência entre contas" />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              type="submit"
              variant="primary"
              disabled={isPending || !fromAccountId || !toAccountId || (isCrossCurrency && !rate)}
            >
              {isPending ? "Salvando…" : "Transferir"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
