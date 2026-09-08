"use client";

import { useState, useTransition } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { linkTransactionAction } from "./actions";
import type { InvestmentAssetRow } from "@/lib/supabase/types";
import type { UnlinkedInvestmentTransaction } from "@/lib/data/investments";
import { natureLabels } from "@/lib/domain/labels";
import { formatCentsToBRL } from "@/lib/money/money";
import { sortByName } from "@/lib/utils/sort";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/**
 * O caminho de volta da ponte entre as abas: um lançamento que já existe no
 * extrato (uma aplicação, um resgate, um dividendo que caiu na conta) vira
 * movimento do ativo escolhido. O lançamento em si não é alterado nem
 * duplicado — só ganha um vínculo.
 */
export function LinkTransactionDialog({
  spaceId,
  transaction,
  assets,
}: {
  spaceId: string;
  transaction: UnlinkedInvestmentTransaction;
  assets: InvestmentAssetRow[];
}) {
  const [open, setOpen] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [isPending, startTransition] = useTransition();

  const asset = assets.find((a) => a.id === assetId);
  const needsQuantity = asset?.pricing_mode === "cotacao" && transaction.nature !== "rendimento_investimento";

  function handleSubmit() {
    if (!assetId) return;
    startTransition(async () => {
      const parsedQuantity = Number(quantity.replace(/\s/g, "").replace(",", "."));
      const result = await linkTransactionAction(
        spaceId,
        transaction.id,
        assetId,
        Number.isFinite(parsedQuantity) ? parsedQuantity : 0,
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Lançamento vinculado ao ativo");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Link2 className="h-3.5 w-3.5" /> Vincular
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular lançamento a um ativo</DialogTitle>
          <DialogDescription>
            {natureLabels[transaction.nature]} de {formatCentsToBRL(transaction.amount_cents)} em{" "}
            {transaction.movement_date.split("-").reverse().join("/")} — {transaction.original_description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="link-asset">Ativo</Label>
            <Select value={assetId} onValueChange={setAssetId}>
              <SelectTrigger id="link-asset">
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

          {needsQuantity ? (
            <div>
              <Label htmlFor="link-quantity">Quantidade negociada</Label>
              <Input
                id="link-quantity"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="100"
              />
              <p className="mt-1.5 text-[11px] text-text-tertiary">
                O extrato traz só o valor; a quantidade é o que falta para o preço médio fechar.
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
          <Button variant="primary" onClick={handleSubmit} disabled={isPending || !assetId}>
            {isPending ? "Vinculando…" : "Vincular"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
