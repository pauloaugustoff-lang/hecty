import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { createClient } from "@/lib/supabase/server";
import { listReviewTransactions } from "@/lib/data/review";
import { listAccounts } from "@/lib/data/accounts";
import { listCards } from "@/lib/data/cards";
import { listCategories } from "@/lib/data/categories";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckCircle2 } from "lucide-react";
import { ReviewTable } from "./review-table";
import { ReviewSearch } from "./review-search";
import type { TransactionSortBy, TransactionSortDir } from "@/lib/data/transactions";

export default async function RevisarPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; sortBy?: string; sortDir?: string }>;
}) {
  const { search, sortBy, sortDir } = await searchParams;
  const space = await requireCurrentSpace();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [transactions, accounts, cards, categories] = await Promise.all([
    listReviewTransactions(space.id, {
      search,
      sortBy: sortBy as TransactionSortBy | undefined,
      sortDir: sortDir as TransactionSortDir | undefined,
    }),
    listAccounts(space.id),
    listCards(space.id),
    listCategories(space.id),
  ]);

  return (
    <div>
      <PageHeader
        title="Revisar e classificar"
        description="Classifique vários lançamentos de uma vez, sem precisar abrir um por um."
      />

      <Suspense>
        <ReviewSearch />
      </Suspense>

      {transactions.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Tudo classificado"
          description="Não há lançamentos pendentes de classificação no momento."
        />
      ) : (
        <Suspense>
          <ReviewTable
            spaceId={space.id}
            userId={user.id}
            transactions={transactions}
            categories={categories}
            accounts={accounts}
            cards={cards}
          />
        </Suspense>
      )}
    </div>
  );
}
