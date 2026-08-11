"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { createCardAction, updateCardAction, type ActionState } from "./actions";
import type { CardRow } from "@/lib/data/cards";
import type { AccountRow } from "@/lib/data/accounts";
import { cardBrandLabels } from "@/lib/domain/labels";
import { parseBRLToCents, formatCentsToBRL } from "@/lib/money/money";
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

const initialState: ActionState = {};

export function CardFormDialog({
  spaceId,
  accounts,
  card,
}: {
  spaceId: string;
  accounts: AccountRow[];
  card?: CardRow;
}) {
  const isEdit = Boolean(card);
  const [open, setOpen] = useState(false);
  const boundAction = isEdit ? updateCardAction.bind(null, card!.id, spaceId) : createCardAction.bind(null, spaceId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const [brand, setBrand] = useState(card?.brand ?? "visa");
  const [paymentAccountId, setPaymentAccountId] = useState(card?.payment_account_id ?? "");
  const [limitInput, setLimitInput] = useState(
    card ? formatCentsToBRL(card.limit_cents).replace("R$", "").trim() : "",
  );

  useEffect(() => {
    if (state.success) {
      toast.success(isEdit ? "Cartão atualizado" : "Cartão criado");
      setOpen(false);
    }
  }, [state.success, isEdit]);

  let limitCents = 0;
  try {
    limitCents = limitInput ? parseBRLToCents(limitInput) : 0;
  } catch {
    limitCents = 0;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm" aria-label={`Editar ${card?.name}`}>
            <Pencil className="h-3.5 w-3.5" /> Editar
          </Button>
        ) : (
          <Button variant="primary">
            <Plus className="h-4 w-4" /> Novo cartão
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cartão" : "Novo cartão"}</DialogTitle>
          <DialogDescription>As compras no cartão só afetam a conta quando a fatura é paga.</DialogDescription>
        </DialogHeader>

        {state.error ? (
          <Callout tone="danger" className="mb-4">
            {state.error}
          </Callout>
        ) : null}

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="limitCents" value={limitCents} />
          <input type="hidden" name="brand" value={brand} />
          <input type="hidden" name="paymentAccountId" value={paymentAccountId} />

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" required defaultValue={card?.name} placeholder="Cartão Nubank" />
            </div>
            <div>
              <Label htmlFor="institution">Instituição</Label>
              <Input id="institution" name="institution" defaultValue={card?.institution} placeholder="Nubank" />
            </div>
            <div>
              <Label htmlFor="brand">Bandeira</Label>
              <Select value={brand} onValueChange={(v) => setBrand(v as typeof brand)}>
                <SelectTrigger id="brand">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(cardBrandLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="closingDay">Dia de fechamento</Label>
              <Input id="closingDay" name="closingDay" type="number" min={1} max={31} required defaultValue={card?.closing_day ?? 20} />
            </div>
            <div>
              <Label htmlFor="dueDay">Dia de vencimento</Label>
              <Input id="dueDay" name="dueDay" type="number" min={1} max={31} required defaultValue={card?.due_day ?? 27} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="limit">Limite</Label>
              <Input id="limit" inputMode="decimal" value={limitInput} onChange={(e) => setLimitInput(e.target.value)} placeholder="0,00" />
            </div>
            <div className="col-span-2">
              <Label htmlFor="paymentAccount">Conta usada para pagar a fatura</Label>
              <Select value={paymentAccountId} onValueChange={setPaymentAccountId}>
                <SelectTrigger id="paymentAccount">
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
