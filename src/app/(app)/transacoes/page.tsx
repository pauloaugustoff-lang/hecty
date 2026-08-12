import { Suspense } from "react";
import Link from "next/link";
import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { listTransactions } from "@/lib/data/transactions";
import { listAccounts } from "@/lib/data/accounts";
import { listCards } from "@/lib/data/cards";
import { listCategories } from "@/lib/data/categories";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, ChevronLeft, ChevronRight } from "lucide-react";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { TransferDialog } from "./transfer-dialog";
import { CardPaymentDialog } from "./card-payment-dialog";
import { TransactionFilters } from "./transaction-filters";
import { TransactionsTable } from "./transactions-table";
import type { TransactionNature } from "@/lib/supabase/types";
import type { TransactionSortBy, TransactionSortDir } from "@/lib/data/transactions";

const PAGE_SIZE = 50;

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
      minAmountCents: params.minAmount ? Number(params.minAmount) : undefined,
      maxAmountCents: params.maxAmount ? Number(params.maxAmount) : undefined,
      limit: PAGE_SIZE,
      offset,
      sortBy: params.sortBy as TransactionSortBy | undefined,
      sortDir: params.sortDir as TransactionSortDir | undefined,
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
          <Suspense>
            <TransactionsTable spaceId={space.id} transactions={rows} accounts={accounts} cards={cards} categories={categories} />
          </Suspense>

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
