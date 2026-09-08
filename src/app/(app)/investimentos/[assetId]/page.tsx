import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Link2 } from "lucide-react";
import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { listAccounts } from "@/lib/data/accounts";
import { getAsset, listAssets, listMovements, loadPortfolio } from "@/lib/data/investments";
import {
  assetClassLabels,
  movementTypeLabels,
  pricingModeLabels,
  rateSummary,
} from "@/lib/investments/labels";
import { formatCents } from "@/lib/money/money";
import { PageHeader } from "@/components/layout/page-header";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { AssetFormDialog } from "../asset-form-dialog";
import { MovementFormDialog } from "../movement-form-dialog";
import { ArchiveAssetButton, DeleteAssetButton, DeleteMovementButton } from "../asset-row-actions";
import { AutoRefreshQuotes } from "../auto-refresh-quotes";

function formatQuantity(quantity: number): string {
  return quantity.toLocaleString("pt-BR", { maximumFractionDigits: 8 });
}

function toneFor(value: number | null): string {
  if (value === null || value === 0) return "text-text-primary";
  return value > 0 ? "text-positive" : "text-negative";
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface-raised p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">{label}</p>
      <p className={cn("mt-1.5 text-lg font-semibold tabular", tone ?? "text-text-primary")}>{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-text-tertiary">{hint}</p> : null}
    </div>
  );
}

export default async function AssetPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const space = await requireCurrentSpace();
  const asset = await getAsset(space.id, assetId);
  if (!asset) notFound();

  const [portfolio, movements, accounts, allAssets] = await Promise.all([
    loadPortfolio(space.id, { includeArchived: true }),
    listMovements(space.id, assetId),
    listAccounts(space.id),
    listAssets(space.id),
  ]);

  const position = portfolio.assets.find((entry) => entry.asset.id === assetId)?.position;
  // listAssets omite arquivados; sem o ativo atual na lista o diálogo de
  // movimento perderia a moeda dele e cairia no padrão BRL.
  const assetOptions = allAssets.some((a) => a.id === asset.id) ? allAssets : [asset, ...allAssets];
  const currency = asset.currency;

  const descriptionParts = [
    assetClassLabels[asset.asset_class],
    asset.ticker,
    rateSummary(asset),
    asset.institution,
    pricingModeLabels[asset.pricing_mode],
  ].filter(Boolean);

  return (
    <div>
      <Link
        href="/investimentos"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Carteira
      </Link>

      <PageHeader
        title={asset.name}
        description={descriptionParts.join(" · ")}
        actions={
          <>
            <MovementFormDialog
              spaceId={space.id}
              assets={assetOptions}
              accounts={accounts}
              defaultAssetId={asset.id}
            />
            <AssetFormDialog spaceId={space.id} accounts={accounts} asset={asset} />
          </>
        }
      />

      {position ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <Stat
            label="Valor atual"
            value={position.marketValueCents === null ? "sem preço" : formatCents(position.marketValueCents, currency)}
            hint={
              position.valuationDate
                ? `em ${position.valuationDate.split("-").reverse().join("/")}`
                : "atualize as cotações"
            }
          />
          <Stat label="Investido" value={formatCents(position.investedCents, currency)} hint="custo da posição aberta" />
          <Stat
            label="Quantidade"
            value={position.quantity > 0 ? formatQuantity(position.quantity) : "—"}
            hint={
              position.averageCostCents > 0
                ? `preço médio ${formatCents(Math.round(position.averageCostCents), currency)}`
                : undefined
            }
          />
          <Stat
            label="Valorização"
            value={
              position.unrealizedPnlCents === null
                ? "—"
                : formatCents(position.unrealizedPnlCents, currency, { signed: true })
            }
            tone={toneFor(position.unrealizedPnlCents)}
            hint="ainda não realizada"
          />
          <Stat
            label="Realizado"
            value={formatCents(position.realizedPnlCents, currency, { signed: true })}
            tone={toneFor(position.realizedPnlCents)}
            hint={`${formatCents(position.withdrawnCents, currency)} resgatados`}
          />
          <Stat
            label="Proventos"
            value={formatCents(position.incomeCents, currency)}
            hint={position.costsCents > 0 ? `${formatCents(position.costsCents, currency)} em taxas` : undefined}
          />
        </div>
      ) : null}

      <div className="mb-4">
        <AutoRefreshQuotes spaceId={space.id} needsRefresh={portfolio.needsRefresh} />
      </div>

      {asset.notes ? (
        <p className="mb-6 rounded-[var(--radius-md)] border border-border-subtle bg-surface-sunken/50 px-3.5 py-3 text-sm text-text-secondary">
          {asset.notes}
        </p>
      ) : null}

      <h2 className="mb-2 text-[13px] font-medium uppercase tracking-wide text-text-tertiary">Movimentos</h2>

      {movements.length === 0 ? (
        <EmptyState
          title="Nenhum movimento ainda"
          description="Lance o primeiro aporte para a posição deste ativo começar a existir."
          action={
            <MovementFormDialog
              spaceId={space.id}
              assets={assetOptions}
              accounts={accounts}
              defaultAssetId={asset.id}
            />
          }
        />
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-border-subtle bg-surface-raised">
          <Table>
            <Thead>
              <Tr>
                <Th>Data</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Quantidade</Th>
                <Th className="text-right">Preço unitário</Th>
                <Th className="text-right">Valor</Th>
                <Th className="text-right">Taxas / imposto</Th>
                <Th>Lançamento</Th>
                <Th className="w-28" />
              </Tr>
            </Thead>
            <Tbody>
              {movements.map((movement) => (
                <Tr key={movement.id}>
                  <Td className="tabular text-text-secondary">
                    {movement.movement_date.split("-").reverse().join("/")}
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        movement.movement_type === "aporte"
                          ? "transfer"
                          : movement.movement_type === "resgate" || movement.movement_type === "provento"
                            ? "positive"
                            : "neutral"
                      }
                    >
                      {movementTypeLabels[movement.movement_type]}
                    </Badge>
                  </Td>
                  <Td className="text-right tabular text-text-secondary">
                    {movement.movement_type === "desdobramento"
                      ? `x${movement.split_factor}`
                      : movement.quantity > 0
                        ? formatQuantity(movement.quantity)
                        : "—"}
                  </Td>
                  <Td className="text-right tabular text-text-secondary">
                    {movement.unit_price_cents ? formatCents(movement.unit_price_cents, currency) : "—"}
                  </Td>
                  <Td className="text-right tabular">
                    {movement.amount_cents > 0 ? formatCents(movement.amount_cents, currency) : "—"}
                  </Td>
                  <Td className="text-right tabular text-text-secondary">
                    {movement.fees_cents > 0 || movement.tax_cents > 0
                      ? `${formatCents(movement.fees_cents, currency)} / ${formatCents(movement.tax_cents, currency)}`
                      : "—"}
                  </Td>
                  <Td>
                    {movement.transaction_id ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-text-secondary">
                        <Link2 className="h-3 w-3" /> no extrato
                      </span>
                    ) : (
                      <span className="text-[11px] text-text-tertiary">—</span>
                    )}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <MovementFormDialog
                        spaceId={space.id}
                        assets={assetOptions}
                        accounts={accounts}
                        movement={movement}
                        defaultAssetId={asset.id}
                      />
                      <DeleteMovementButton
                        movementId={movement.id}
                        spaceId={space.id}
                        description={`${movementTypeLabels[movement.movement_type]} de ${movement.movement_date.split("-").reverse().join("/")}`}
                      />
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-1 border-t border-border-subtle pt-4">
        <ArchiveAssetButton assetId={asset.id} spaceId={space.id} isArchived={asset.is_archived} />
        {movements.length === 0 ? (
          <DeleteAssetButton assetId={asset.id} spaceId={space.id} assetName={asset.name} />
        ) : null}
      </div>
    </div>
  );
}
