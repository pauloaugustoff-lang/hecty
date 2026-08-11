import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { listCards } from "@/lib/data/cards";
import { listAccounts } from "@/lib/data/accounts";
import { getOpenStatementTotals } from "@/lib/data/card-statements";
import { getStatementPeriod } from "@/lib/transactions/cards";
import { cardBrandLabels } from "@/lib/domain/labels";
import { formatCentsToBRL } from "@/lib/money/money";
import { PageHeader } from "@/components/layout/page-header";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { CreditCard } from "lucide-react";
import { CardFormDialog } from "./card-form-dialog";
import { ArchiveCardButton } from "./archive-card-button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default async function CartoesPage() {
  const space = await requireCurrentSpace();
  const [cards, accounts] = await Promise.all([
    listCards(space.id, { includeArchived: true }),
    listAccounts(space.id),
  ]);

  const active = cards.filter((c) => !c.is_archived);
  const archived = cards.filter((c) => c.is_archived);
  const statementTotals = await getOpenStatementTotals(space.id, active);

  const accountName = (id: string | null) => accounts.find((a) => a.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader title="Cartões" actions={<CardFormDialog spaceId={space.id} accounts={accounts} />} />

      {cards.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="Nenhum cartão cadastrado"
          description="Cadastre seus cartões de crédito para separar as compras da fatura do saldo em conta."
          action={<CardFormDialog spaceId={space.id} accounts={accounts} />}
        />
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-border-subtle">
          <Table>
            <Thead>
              <Tr>
                <Th>Cartão</Th>
                <Th>Bandeira</Th>
                <Th>Fecha / Vence</Th>
                <Th>Conta de pagamento</Th>
                <Th className="text-right">Fatura em aberto</Th>
                <Th className="w-40" />
              </Tr>
            </Thead>
            <Tbody>
              {active.map((card) => {
                const period = getStatementPeriod(card.closing_day, card.due_day, new Date());
                return (
                  <Tr key={card.id}>
                    <Td className="font-medium">{card.name}</Td>
                    <Td className="text-text-secondary">{cardBrandLabels[card.brand]}</Td>
                    <Td className="text-text-secondary tabular text-[13px]">
                      {card.closing_day} / {card.due_day} · vence {format(period.dueDate, "d 'de' MMM", { locale: ptBR })}
                    </Td>
                    <Td className="text-text-secondary">{accountName(card.payment_account_id)}</Td>
                    <Td className="text-right tabular">{formatCentsToBRL(statementTotals[card.id] ?? 0)}</Td>
                    <Td>
                      <div className="flex justify-end gap-1">
                        <CardFormDialog spaceId={space.id} accounts={accounts} card={card} />
                        <ArchiveCardButton cardId={card.id} isArchived={false} />
                      </div>
                    </Td>
                  </Tr>
                );
              })}
              {archived.map((card) => (
                <Tr key={card.id} className="opacity-60">
                  <Td className="font-medium">
                    {card.name} <span className="text-[11px] text-text-tertiary">arquivado</span>
                  </Td>
                  <Td className="text-text-secondary">{cardBrandLabels[card.brand]}</Td>
                  <Td className="text-text-secondary tabular text-[13px]">
                    {card.closing_day} / {card.due_day}
                  </Td>
                  <Td className="text-text-secondary">{accountName(card.payment_account_id)}</Td>
                  <Td className="text-right tabular">—</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <ArchiveCardButton cardId={card.id} isArchived={true} />
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      )}
    </div>
  );
}
