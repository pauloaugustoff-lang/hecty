import Link from "next/link";
import { TrendingUp, AlertCircle } from "lucide-react";
import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { listAccounts } from "@/lib/data/accounts";
import { listAssets, listUnlinkedInvestmentTransactions, loadPortfolio } from "@/lib/data/investments";
import { assetClassLabels, assetGroup, assetGroupLabels, assetGroupOrder, rateSummary } from "@/lib/investments/labels";
import { natureLabels } from "@/lib/domain/labels";
import { formatCents, formatCentsToBRL } from "@/lib/money/money";
import { PageHeader } from "@/components/layout/page-header";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Callout } from "@/components/ui/callout";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { AssetFormDialog } from "./asset-form-dialog";
import { MovementFormDialog } from "./movement-form-dialog";
import { RefreshMarketDataButton } from "./refresh-market-data-button";
import { LinkTransactionDialog } from "./link-transaction-dialog";

function formatQuantity(quantity: number): string {
  return quantity.toLocaleString("pt-BR", { maximumFractionDigits: 8 });
}

function formatPercent(rate: number): string {
  return `${(rate * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2, signDisplay: "always" })}%`;
}

function toneFor(value: number | null): string {
  if (value === null || value === 0) return "text-text-secondary";
  return value > 0 ? "text-positive" : "text-negative";
}

export default async function InvestimentosPage() {
  const space = await requireCurrentSpace();
  const [portfolio, accounts, allAssets, unlinked] = await Promise.all([
    loadPortfolio(space.id),
    listAccounts(space.id),
    listAssets(space.id),
    listUnlinkedInvestmentTransactions(space.id, 12),
  ]);

  const hasAssets = portfolio.assets.length > 0;
  const totalsDescription = portfolio.totals
    .map((t) => formatCents(t.marketValueCents, t.currency))
    .join(" · ");

  return (
    <div>
      <PageHeader
        title="Investimentos"
        description={hasAssets ? `Patrimônio investido: ${totalsDescription}` : undefined}
        actions={
          <>
            <RefreshMarketDataButton spaceId={space.id} />
            {hasAssets ? (
              <MovementFormDialog spaceId={space.id} assets={allAssets} accounts={accounts} />
            ) : null}
            <AssetFormDialog spaceId={space.id} accounts={accounts} />
          </>
        }
      />

      {!hasAssets ? (
        <EmptyState
          icon={TrendingUp}
          title="Nenhum ativo cadastrado"
          description="Cadastre uma ação, um fundo imobiliário, um CDB — o que você tiver. Depois lance os aportes e a carteira passa a mostrar quanto vale hoje, calculando cotação ou taxa conforme o tipo."
          action={<AssetFormDialog spaceId={space.id} accounts={accounts} />}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {portfolio.totals.map((totals) => (
              <div
                key={totals.currency}
                className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface-raised p-5 shadow-[var(--shadow-sm)]"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                  Patrimônio em {totals.currency}
                </p>
                <p className="mt-2 text-[23px] font-semibold tabular text-text-primary">
                  {formatCents(totals.marketValueCents, totals.currency)}
                </p>
                <p className="mt-1 text-[11px] text-text-tertiary">
                  {formatCents(totals.investedCents, totals.currency)} investidos
                  {totals.unpricedAssets > 0
                    ? ` · ${totals.unpricedAssets} ativo(s) sem preço fora da soma`
                    : ""}
                </p>
              </div>
            ))}

            {portfolio.totals.map((totals) => {
              const result = totals.unrealizedPnlCents + totals.realizedPnlCents + totals.incomeCents;
              return (
                <div
                  key={`${totals.currency}-resultado`}
                  className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface-raised p-5 shadow-[var(--shadow-sm)]"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
                    Resultado em {totals.currency}
                  </p>
                  <p className={cn("mt-2 text-[23px] font-semibold tabular", toneFor(result))}>
                    {formatCents(result, totals.currency, { signed: true })}
                  </p>
                  <p className="mt-1 text-[11px] text-text-tertiary">
                    {formatCents(totals.incomeCents, totals.currency)} em proventos ·{" "}
                    {formatCents(totals.realizedPnlCents, totals.currency, { signed: true })} realizado
                  </p>
                </div>
              );
            })}
          </div>

          {portfolio.missingQuotes.length > 0 ? (
            <Callout tone="warning" title="Ativos sem cotação">
              Ainda não há preço para {portfolio.missingQuotes.join(", ")}. Clique em “Atualizar cotações” — se o
              símbolo continuar sem retorno, confira o ticker no cadastro do ativo ou passe a informar o saldo
              manualmente. Enquanto isso, eles ficam fora do patrimônio somado.
            </Callout>
          ) : null}

          {portfolio.oldestQuoteDate ? (
            <p className="text-[12px] text-text-tertiary">
              Cotação mais antiga em uso: {portfolio.oldestQuoteDate.split("-").reverse().join("/")}. Renda fixa é
              estimativa calculada pelo índice, não marcação a mercado da corretora.
            </p>
          ) : null}

          {assetGroupOrder.map((group) => {
            const entries = portfolio.assets.filter((entry) => assetGroup(entry.asset.asset_class) === group);
            if (entries.length === 0) return null;

            return (
              <section key={group} className="space-y-2">
                <h2 className="text-[13px] font-medium uppercase tracking-wide text-text-tertiary">
                  {assetGroupLabels[group]}
                </h2>
                <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface-raised">
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>Ativo</Th>
                        <Th className="text-right">Quantidade</Th>
                        <Th className="text-right">Preço médio</Th>
                        <Th className="text-right">Preço atual</Th>
                        <Th className="text-right">Investido</Th>
                        <Th className="text-right">Valor atual</Th>
                        <Th className="text-right">Resultado</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {entries.map(({ asset, position }) => (
                        <Tr key={asset.id}>
                          <Td>
                            <Link href={`/investimentos/${asset.id}`} className="flex items-center gap-2 hover:underline">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: asset.color }}
                              />
                              <span>
                                <span className="font-medium">{asset.name}</span>
                                <span className="block text-[11px] text-text-tertiary">
                                  {asset.ticker ? `${asset.ticker} · ` : ""}
                                  {assetClassLabels[asset.asset_class]}
                                  {rateSummary(asset) ? ` · ${rateSummary(asset)}` : ""}
                                </span>
                              </span>
                            </Link>
                          </Td>
                          <Td className="text-right tabular text-text-secondary">
                            {position.quantity > 0 ? formatQuantity(position.quantity) : "—"}
                          </Td>
                          <Td className="text-right tabular text-text-secondary">
                            {position.averageCostCents > 0
                              ? formatCents(Math.round(position.averageCostCents), asset.currency)
                              : "—"}
                          </Td>
                          <Td className="text-right tabular text-text-secondary">
                            {position.priceCents !== null ? formatCents(position.priceCents, asset.currency) : "—"}
                          </Td>
                          <Td className="text-right tabular">{formatCents(position.investedCents, asset.currency)}</Td>
                          <Td className="text-right tabular">
                            {position.marketValueCents === null ? (
                              <span className="inline-flex items-center gap-1 text-[12px] text-pending">
                                <AlertCircle className="h-3.5 w-3.5" /> sem preço
                              </span>
                            ) : (
                              formatCents(position.marketValueCents, asset.currency)
                            )}
                          </Td>
                          <Td className={cn("text-right tabular", toneFor(position.totalReturnCents))}>
                            {position.totalReturnCents === null ? (
                              "—"
                            ) : (
                              <>
                                {formatCents(position.totalReturnCents, asset.currency, { signed: true })}
                                {position.returnRate !== null ? (
                                  <span className="block text-[11px] opacity-80">
                                    {formatPercent(position.returnRate)}
                                  </span>
                                ) : null}
                              </>
                            )}
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {unlinked.length > 0 ? (
        <section className="mt-8 space-y-2">
          <h2 className="text-[13px] font-medium uppercase tracking-wide text-text-tertiary">
            Lançamentos de investimento sem ativo
          </h2>
          <Callout tone="info">
            Estes lançamentos já estão no extrato, mas ninguém disse a que ativo pertencem — por isso não entram na
            posição da carteira. Vincule cada um ao papel correspondente.
          </Callout>
          <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface-raised">
            <Table>
              <Thead>
                <Tr>
                  <Th>Data</Th>
                  <Th>Descrição</Th>
                  <Th>Natureza</Th>
                  <Th className="text-right">Valor</Th>
                  <Th className="w-28" />
                </Tr>
              </Thead>
              <Tbody>
                {unlinked.map((transaction) => (
                  <Tr key={transaction.id}>
                    <Td className="tabular text-text-secondary">
                      {transaction.movement_date.split("-").reverse().join("/")}
                    </Td>
                    <Td>{transaction.original_description}</Td>
                    <Td>
                      <Badge tone={transaction.direction === "saida" ? "transfer" : "positive"}>
                        {natureLabels[transaction.nature]}
                      </Badge>
                    </Td>
                    <Td className="text-right tabular">{formatCentsToBRL(transaction.amount_cents)}</Td>
                    <Td>
                      <div className="flex justify-end">
                        {allAssets.length > 0 ? (
                          <LinkTransactionDialog
                            spaceId={space.id}
                            transaction={transaction}
                            assets={allAssets}
                          />
                        ) : (
                          <span className="text-[11px] text-text-tertiary">cadastre um ativo</span>
                        )}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
