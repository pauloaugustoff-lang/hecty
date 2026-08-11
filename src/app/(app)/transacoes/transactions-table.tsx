"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2 } from "lucide-react";
import type { TransactionWithRelations } from "@/lib/data/transactions";
import type { AccountRow } from "@/lib/data/accounts";
import type { CardRow } from "@/lib/data/cards";
import type { CategoryRow } from "@/lib/data/categories";
import { natureLabels, natureTones } from "@/lib/domain/labels";
import { formatCentsToBRL } from "@/lib/money/money";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { DeleteTransactionButton } from "./delete-transaction-button";
import { deleteTransactionsAction } from "./actions";

const TONE_CSS_VAR: Record<string, string> = {
  positive: "var(--positive)",
  negative: "var(--negative)",
  pending: "var(--pending)",
  transfer: "var(--transfer)",
  neutral: "var(--border-strong)",
};

export function TransactionsTable({
  spaceId,
  transactions,
  accounts,
  cards,
  categories,
}: {
  spaceId: string;
  transactions: TransactionWithRelations[];
  accounts: AccountRow[];
  cards: CardRow[];
  categories: CategoryRow[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === transactions.length ? new Set() : new Set(transactions.map((t) => t.id))));
  }

  function handleBulkDelete() {
    if (!confirm(`Excluir ${selected.size} lançamento(s) selecionado(s)? Eles podem ser recuperados pelo administrador do espaço se necessário.`)) return;
    startTransition(async () => {
      const result = await deleteTransactionsAction(Array.from(selected));
      if (result.error) toast.error(result.error);
      else {
        toast.success(`${selected.size} lançamento(s) excluído(s)`);
        setSelected(new Set());
      }
    });
  }

  return (
    <div>
      {selected.size > 0 ? (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-border-subtle bg-surface-sunken px-4 py-2.5">
          <p className="text-sm text-text-secondary">{selected.size} selecionado(s)</p>
          <Button variant="danger" size="sm" onClick={handleBulkDelete} disabled={isPending}>
            <Trash2 className="h-3.5 w-3.5" /> Excluir selecionados
          </Button>
        </div>
      ) : null}

      <div className="rounded-[var(--radius-lg)] border border-border-subtle">
        <Table>
          <Thead>
            <Tr>
              <Th className="w-10">
                <Checkbox
                  checked={selected.size === transactions.length && transactions.length > 0}
                  onCheckedChange={toggleAll}
                  aria-label="Selecionar todos"
                />
              </Th>
              <Th>Data</Th>
              <Th>Descrição</Th>
              <Th>Conta / cartão</Th>
              <Th>Categoria</Th>
              <Th>Natureza</Th>
              <Th className="text-right">Valor</Th>
              <Th className="w-20" />
            </Tr>
          </Thead>
          <Tbody>
            {transactions.map((tx) => (
              <Tr key={tx.id} className="border-l-2" style={{ borderLeftColor: TONE_CSS_VAR[natureTones[tx.nature]] }}>
                <Td>
                  <Checkbox checked={selected.has(tx.id)} onCheckedChange={() => toggle(tx.id)} aria-label={`Selecionar ${tx.original_description}`} />
                </Td>
                <Td className="whitespace-nowrap text-text-secondary tabular text-[13px]">
                  {format(new Date(`${tx.movement_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                </Td>
                <Td>
                  <TransactionFormDialog
                    spaceId={spaceId}
                    accounts={accounts}
                    cards={cards}
                    categories={categories}
                    transaction={tx}
                    trigger={
                      <button className="text-left font-medium text-text-primary hover:text-accent">
                        {tx.original_description}
                      </button>
                    }
                  />
                  {tx.installment_total ? (
                    <span className="ml-1.5 text-[11px] text-text-tertiary">
                      {tx.installment_number}/{tx.installment_total}
                    </span>
                  ) : null}
                </Td>
                <Td className="text-text-secondary">{tx.account?.name ?? tx.card?.name ?? "—"}</Td>
                <Td className="text-text-secondary">
                  {tx.category?.name ?? <span className="text-text-tertiary">Sem categoria</span>}
                  {tx.subcategory ? ` · ${tx.subcategory.name}` : ""}
                </Td>
                <Td>
                  <Badge tone={natureTones[tx.nature]}>{natureLabels[tx.nature]}</Badge>
                </Td>
                <Td className={`text-right tabular font-medium ${tx.direction === "entrada" ? "text-positive" : "text-text-primary"}`}>
                  {tx.direction === "saida" ? "−" : "+"}
                  {formatCentsToBRL(tx.amount_cents)}
                </Td>
                <Td>
                  <DeleteTransactionButton transactionId={tx.id} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}
