"use client";

import { useActionState, useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { createCardPaymentAction, type CardPaymentActionState } from "./actions";
import type { AccountRow } from "@/lib/data/accounts";
import type { CardRow } from "@/lib/data/cards";
import { parseBRLToCents } from "@/lib/money/money";
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

const initialState: CardPaymentActionState = {};

export function CardPaymentDialog({ spaceId, accounts, cards }: { spaceId: string; accounts: AccountRow[]; cards: CardRow[] }) {
  const [open, setOpen] = useState(false);
  const boundAction = createCardPaymentAction.bind(null, spaceId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const [accountId, setAccountId] = useState("");
  const [cardId, setCardId] = useState("");
  const [amountInput, setAmountInput] = useState("");

  useEffect(() => {
    if (state.success) {
      toast.success("Pagamento de fatura registrado");
      setOpen(false);
    }
  }, [state]);

  let amountCents = 0;
  try {
    amountCents = amountInput ? parseBRLToCents(amountInput) : 0;
  } catch {
    amountCents = 0;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <CreditCard className="h-4 w-4" /> Pagar fatura
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pagamento de fatura</DialogTitle>
          <DialogDescription>
            O pagamento não é despesa — as compras já foram lançadas no cartão. Isso apenas registra a saída da conta.
          </DialogDescription>
        </DialogHeader>

        {state.error ? (
          <Callout tone="danger" className="mb-4">
            {state.error}
          </Callout>
        ) : null}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="accountId" value={accountId} />
          <input type="hidden" name="cardId" value={cardId} />
          <input type="hidden" name="amountCents" value={amountCents} />

          <div>
            <Label htmlFor="cardId">Cartão</Label>
            <Select value={cardId} onValueChange={setCardId}>
              <SelectTrigger id="cardId">
                <SelectValue placeholder="Selecione o cartão" />
              </SelectTrigger>
              <SelectContent>
                {cards.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="accountId">Pago com a conta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="accountId">
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="amount">Valor pago</Label>
              <Input id="amount" inputMode="decimal" required value={amountInput} onChange={(e) => setAmountInput(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label htmlFor="movementDate">Data</Label>
              <Input id="movementDate" name="movementDate" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" variant="primary" disabled={isPending || !accountId || !cardId}>
              {isPending ? "Salvando…" : "Registrar pagamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
