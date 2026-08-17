"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trash2, Pencil, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import type { TransactionWithRelations, TransactionSortBy } from "@/lib/data/transactions";
import { transactionCurrency } from "@/lib/domain/transaction-currency";
import type { AccountRow } from "@/lib/data/accounts";
import type { CardRow } from "@/lib/data/cards";
import type { CategoryRow } from "@/lib/data/categories";
import type { TagRow } from "@/lib/data/tags";
import { natureLabels, natureTones } from "@/lib/domain/labels";
import { formatCents } from "@/lib/money/money";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { DeleteTransactionButton } from "./delete-transaction-button";
import { BulkCategoryDialog } from "./bulk-category-dialog";
import { deleteTransactionsAction } from "./actions";

const SORTABLE_COLUMNS: { key: TransactionSortBy; label: string }[] = [
  { key: "date", label: "Data" },
  { key: "description", label: "Descrição" },
  { key: "account", label: "Conta / cartão" },
  { key: "category", label: "Categoria" },
  { key: "nature", label: "Natureza" },
  { key: "value", label: "Valor" },
];

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
  tags,
}: {
  spaceId: string;
  transactions: TransactionWithRelations[];
  accounts: AccountRow[];
  cards: CardRow[];
  categories: CategoryRow[];
  tags: TagRow[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeSortBy = (searchParams.get("sortBy") as TransactionSortBy | null) ?? "date";
  const activeSortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

  function handleSort(column: TransactionSortBy) {
    const nextDir = activeSortBy === column && activeSortDir === "desc" ? "asc" : "desc";
    const params = new URLSearchParams(searchParams.toString());
    params.set("sortBy", column);
    params.set("sortDir", nextDir);
    params.delete("offset");
    router.push(`${pathname}?${params.toString()}`);
  }

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
          <div className="flex gap-2">
            <BulkCategoryDialog
              spaceId={spaceId}
              categories={categories}
              tags={tags}
              transactionIds={Array.from(selected)}
              onDone={() => setSelected(new Set())}
            />
            <Button variant="danger" size="sm" onClick={handleBulkDelete} disabled={isPending}>
              <Trash2 className="h-3.5 w-3.5" /> Excluir selecionados
            </Button>
          </div>
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
              {SORTABLE_COLUMNS.map((col) => (
                <Th key={col.key} className={col.key === "value" ? "text-right" : undefined}>
                  <button
                    type="button"
                    onClick={() => handleSort(col.key)}
                    className={`inline-flex items-center gap-1 hover:text-text-primary ${col.key === "value" ? "flex-row-reverse" : ""}`}
                  >
                    {col.label}
                    {activeSortBy === col.key ? (
                      activeSortDir === "asc" ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )
                    ) : (
                      <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                    )}
                  </button>
                </Th>
              ))}
              <Th className="w-24" />
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
                  {tx.competence_date !== tx.movement_date ? (
                    <span className="block text-[11px] text-text-tertiary">
                      sai {format(new Date(`${tx.competence_date}T00:00:00`), "dd/MM", { locale: ptBR })}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  <TransactionFormDialog
                    spaceId={spaceId}
                    accounts={accounts}
                    cards={cards}
                    categories={categories}
                    tags={tags}
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
                  {formatCents(tx.amount_cents, transactionCurrency(tx))}
                </Td>
                <Td>
                  <div className="flex justify-end gap-0.5">
                    <TransactionFormDialog
                      spaceId={spaceId}
                      accounts={accounts}
                      cards={cards}
                      categories={categories}
                      tags={tags}
                      transaction={tx}
                      trigger={
                        <Button variant="ghost" size="icon" aria-label={`Editar ${tx.original_description}`}>
                          <Pencil className="h-3.5 w-3.5 text-text-tertiary" />
                        </Button>
                      }
                    />
                    <DeleteTransactionButton transactionId={tx.id} />
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}
