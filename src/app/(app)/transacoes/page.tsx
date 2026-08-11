import { Suspense } from "react";
import Link from "next/link";
import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { listTransactions } from "@/lib/data/transactions";
import { listAccounts } from "@/lib/data/accounts";
import { listCards } from "@/lib/data/cards";
import { listCategories } from "@/lib/data/categories";
import { natureLabels, natureTones } from "@/lib/domain/labels";
import { formatCentsToBRL } from "@/lib/money/money";
import { PageHeader } from "@/components/layout/page-header";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { TransferDialog } from "./transfer-dialog";
import { CardPaymentDialog } from "./card-payment-dialog";
import { TransactionFilters } from "./transaction-filters";
import { DeleteTransactionButton } from "./delete-transaction-button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { TransactionNature } from "@/lib/supabase/types";

const PAGE_SIZE = 50;

const TONE_CSS_VAR: Record<string, string> = {
  positive: "var(--positive)",
  negative: "var(--negative)",
  pending: "var(--pending)",
  transfer: "var(--transfer)",
  neutral: "var(--border-strong)",
};

export default async function TransacoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const space = await requireCurrentSpace();
  const offset = Number(params.offset ?? 0);

  const [accounts, cards, categories, { rows, count }] = await Promise.all([
    listAccounts(space.id),
    listCards(space.id),
    listCategories(space.id),
    listTransactions(space.id, {
      from: params.from,
      to: params.to,
      accountId: params.accountId,
      cardId: params.cardId,
      categoryId: params.categoryId,
      nature: params.nature as TransactionNature | undefined,
      search: params.search,
      limit: PAGE_SIZE,
      offset,
    }),
  ]);

  const hasNext = offset + PAGE_SIZE < count;
  const hasPrev = offset > 0;

  function pageHref(newOffset: number) {
    const query = new URLSearchParams(params as Record<string, string>);
    query.set("offset", String(newOffset));
    return `/transacoes?${query.toString()}`;
  }

  return (
    <div>
      <PageHeader
        title="Transações"
        description={`${count} lançamento${count === 1 ? "" : "s"}`}
        actions={
          <>
            <CardPaymentDialog spaceId={space.id} accounts={accounts} cards={cards} />
            <TransferDialog spaceId={space.id} accounts={accounts} />
            <TransactionFormDialog spaceId={space.id} accounts={accounts} cards={cards} categories={categories} />
          </>
        }
      />

      <Suspense>
        <TransactionFilters accounts={accounts} cards={cards} />
      </Suspense>

      {rows.length === 0 ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Nenhum lançamento encontrado"
          description="Ajuste os filtros ou lance sua primeira movimentação manualmente, ou importe um extrato."
          action={
            <div className="flex gap-2">
              <TransactionFormDialog spaceId={space.id} accounts={accounts} cards={cards} categories={categories} />
              <Button asChild variant="secondary">
                <Link href="/importar">Importar extrato</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <div className="rounded-[var(--radius-lg)] border border-border-subtle">
            <Table>
              <Thead>
                <Tr>
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
                {rows.map((tx) => (
                  <Tr key={tx.id} className="border-l-2" style={{ borderLeftColor: TONE_CSS_VAR[natureTones[tx.nature]] }}>
                    <Td className="whitespace-nowrap text-text-secondary tabular text-[13px]">
                      {format(new Date(`${tx.movement_date}T00:00:00`), "dd/MM/yyyy", { locale: ptBR })}
                    </Td>
                    <Td>
                      <TransactionFormDialog
                        spaceId={space.id}
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

          <div className="mt-4 flex items-center justify-between text-sm text-text-secondary">
            <span>
              {offset + 1}–{Math.min(offset + PAGE_SIZE, count)} de {count}
            </span>
            <div className="flex gap-2">
              {hasPrev ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(Math.max(0, offset - PAGE_SIZE))}>
                    <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                  </Link>
                </Button>
              ) : (
                <Button variant="secondary" size="sm" disabled>
                  <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                </Button>
              )}
              {hasNext ? (
                <Button asChild variant="secondary" size="sm">
                  <Link href={pageHref(offset + PAGE_SIZE)}>
                    Próxima <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : (
                <Button variant="secondary" size="sm" disabled>
                  Próxima <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
