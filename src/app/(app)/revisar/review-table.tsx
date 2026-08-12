"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { TransactionWithRelations, TransactionSortBy } from "@/lib/data/transactions";
import type { AccountRow } from "@/lib/data/accounts";
import type { CardRow } from "@/lib/data/cards";
import type { CategoryRow } from "@/lib/data/categories";
import { natureLabels, natureTones } from "@/lib/domain/labels";
import { formatCentsToBRL } from "@/lib/money/money";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Layers, ArrowLeftRight, Sparkles, CreditCard, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BulkClassifyDialog } from "./bulk-classify-dialog";
import { markAsTransferAction, markAsCardPaymentAction, applyRulesToUnclassifiedAction } from "./actions";

const SORTABLE_COLUMNS: { key: TransactionSortBy; label: string }[] = [
  { key: "date", label: "Data" },
  { key: "description", label: "Descrição" },
  { key: "account", label: "Conta / cartão" },
  { key: "value", label: "Valor" },
  { key: "nature", label: "Sugestão" },
];

export function ReviewTable({
  spaceId,
  userId,
  transactions,
  categories,
  cards,
}: {
  spaceId: string;
  userId: string;
  transactions: TransactionWithRelations[];
  categories: CategoryRow[];
  accounts: AccountRow[];
  cards: CardRow[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cardPaymentCardId, setCardPaymentCardId] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeSortBy = searchParams.get("sortBy") as TransactionSortBy | null;
  const activeSortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";

  function handleSort(column: TransactionSortBy) {
    const nextDir = activeSortBy === column && activeSortDir === "desc" ? "asc" : "desc";
    const params = new URLSearchParams(searchParams.toString());
    params.set("sortBy", column);
    params.set("sortDir", nextDir);
    router.push(`${pathname}?${params.toString()}`);
  }

  const groups = useMemo(() => {
    const map = new Map<string, TransactionWithRelations[]>();
    for (const tx of transactions) {
      const list = map.get(tx.normalized_description) ?? [];
      list.push(tx);
      map.set(tx.normalized_description, list);
    }
    return map;
  }, [transactions]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectGroup(description: string) {
    const ids = groups.get(description)?.map((t) => t.id) ?? [];
    setSelected((prev) => new Set([...prev, ...ids]));
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === transactions.length ? new Set() : new Set(transactions.map((t) => t.id))));
  }

  function handleMarkTransfer() {
    if (selected.size !== 2) {
      toast.error("Selecione exatamente 2 lançamentos para marcar como transferência.");
      return;
    }
    const [a, b] = Array.from(selected);
    startTransition(async () => {
      const result = await markAsTransferAction(spaceId, { transactionAId: a, transactionBId: b });
      if (result.error) toast.error(result.error);
      else {
        toast.success("Marcado como transferência entre contas");
        setSelected(new Set());
      }
    });
  }

  function handleMarkCardPayment() {
    if (selected.size !== 1 || !cardPaymentCardId) return;
    const [transactionId] = Array.from(selected);
    startTransition(async () => {
      const result = await markAsCardPaymentAction(spaceId, { transactionId, cardId: cardPaymentCardId });
      if (result.error) toast.error(result.error);
      else {
        toast.success("Marcado como pagamento de fatura");
        setSelected(new Set());
        setCardPaymentCardId("");
      }
    });
  }

  function handleApplyRules() {
    startTransition(async () => {
      const result = await applyRulesToUnclassifiedAction(spaceId);
      if (result.error) toast.error(result.error);
      else toast.success(`${result.updatedCount} lançamento(s) classificado(s) por regras`);
    });
  }

  const selectedTransactions = transactions.filter((t) => selected.has(t.id));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          {selected.size > 0 ? `${selected.size} selecionado(s)` : `${transactions.length} lançamento(s) pendente(s)`}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={handleApplyRules} disabled={isPending}>
            <Sparkles className="h-3.5 w-3.5" /> Aplicar regras existentes
          </Button>
          {selected.size === 2 ? (
            <Button variant="secondary" size="sm" onClick={handleMarkTransfer} disabled={isPending}>
              <ArrowLeftRight className="h-3.5 w-3.5" /> Marcar como transferência
            </Button>
          ) : null}
          {selected.size === 1 && cards.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <Select value={cardPaymentCardId || "choose"} onValueChange={(v) => setCardPaymentCardId(v === "choose" ? "" : v)}>
                <SelectTrigger className="h-8 w-40 text-[13px]">
                  <SelectValue placeholder="Qual cartão?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="choose" disabled>
                    Qual cartão?
                  </SelectItem>
                  {cards.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="secondary" size="sm" onClick={handleMarkCardPayment} disabled={isPending || !cardPaymentCardId}>
                <CreditCard className="h-3.5 w-3.5" /> Marcar como pagamento de fatura
              </Button>
            </div>
          ) : null}
          {selected.size > 0 ? (
            <BulkClassifyDialog
              spaceId={spaceId}
              userId={userId}
              categories={categories}
              selectedTransactions={selectedTransactions}
              onDone={() => setSelected(new Set())}
            />
          ) : null}
        </div>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-border-subtle">
        <Table>
          <Thead>
            <Tr>
              <Th className="w-10">
                <Checkbox checked={selected.size === transactions.length && transactions.length > 0} onCheckedChange={toggleAll} aria-label="Selecionar todos" />
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
              <Th>Status</Th>
              <Th className="w-10" />
            </Tr>
          </Thead>
          <Tbody>
            {transactions.map((tx) => {
              const groupSize = groups.get(tx.normalized_description)?.length ?? 1;
              return (
                <Tr key={tx.id}>
                  <Td>
                    <Checkbox checked={selected.has(tx.id)} onCheckedChange={() => toggle(tx.id)} aria-label={`Selecionar ${tx.original_description}`} />
                  </Td>
                  <Td className="whitespace-nowrap text-text-secondary tabular text-[13px]">
                    {format(new Date(`${tx.movement_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                  </Td>
                  <Td>
                    <p className="font-medium text-text-primary">{tx.original_description}</p>
                    {tx.normalized_description !== tx.original_description.toUpperCase() ? (
                      <p className="text-[11px] text-text-tertiary">{tx.normalized_description}</p>
                    ) : null}
                  </Td>
                  <Td className="text-text-secondary">{tx.account?.name ?? tx.card?.name ?? "—"}</Td>
                  <Td className="text-right tabular font-medium">{formatCentsToBRL(tx.amount_cents)}</Td>
                  <Td>
                    <Badge tone={natureTones[tx.nature]}>{natureLabels[tx.nature]}</Badge>
                  </Td>
                  <Td className="text-[13px] text-text-secondary">
                    {tx.classification_status === "nao_classificado" ? "Não classificado" : "Revisão pendente"}
                  </Td>
                  <Td>
                    {groupSize > 1 ? (
                      <Button variant="ghost" size="icon" onClick={() => selectGroup(tx.normalized_description)} aria-label={`Selecionar ${groupSize} lançamentos semelhantes`}>
                        <Layers className="h-3.5 w-3.5 text-text-tertiary" />
                      </Button>
                    ) : null}
                  </Td>
                </Tr>
              );
            })}
          </Tbody>
        </Table>
      </div>
    </div>
  );
}
