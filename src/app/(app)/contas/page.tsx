import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { listAccounts, getAccountBalances } from "@/lib/data/accounts";
import { accountTypeLabels } from "@/lib/domain/labels";
import { formatCentsToBRL } from "@/lib/money/money";
import { PageHeader } from "@/components/layout/page-header";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Landmark } from "lucide-react";
import { AccountFormDialog } from "./account-form-dialog";
import { ArchiveAccountButton } from "./archive-account-button";

export default async function ContasPage() {
  const space = await requireCurrentSpace();
  const [accounts, balances] = await Promise.all([
    listAccounts(space.id, { includeArchived: true }),
    getAccountBalances(space.id),
  ]);

  const active = accounts.filter((a) => !a.is_archived);
  const archived = accounts.filter((a) => a.is_archived);
  const totalBalance = active.reduce((sum, a) => sum + (balances[a.id] ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Contas"
        description={`Saldo total das contas ativas: ${formatCentsToBRL(totalBalance)}`}
        actions={<AccountFormDialog spaceId={space.id} />}
      />

      {accounts.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="Nenhuma conta cadastrada"
          description="Cadastre suas contas correntes, poupanças, corretoras e carteiras para começar a lançar movimentações."
          action={<AccountFormDialog spaceId={space.id} />}
        />
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-border-subtle">
          <Table>
            <Thead>
              <Tr>
                <Th>Conta</Th>
                <Th>Instituição</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Saldo atual</Th>
                <Th className="w-40" />
              </Tr>
            </Thead>
            <Tbody>
              {active.map((account) => (
                <Tr key={account.id}>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: account.color }} />
                      <span className="font-medium">{account.name}</span>
                    </div>
                  </Td>
                  <Td className="text-text-secondary">{account.institution || "—"}</Td>
                  <Td className="text-text-secondary">{accountTypeLabels[account.type]}</Td>
                  <Td className="text-right tabular">
                    {formatCentsToBRL(balances[account.id] ?? account.initial_balance_cents)}
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <AccountFormDialog spaceId={space.id} account={account} />
                      <ArchiveAccountButton accountId={account.id} isArchived={false} />
                    </div>
                  </Td>
                </Tr>
              ))}
              {archived.map((account) => (
                <Tr key={account.id} className="opacity-60">
                  <Td>
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: account.color }} />
                      <span className="font-medium">{account.name}</span>
                      <span className="text-[11px] text-text-tertiary">arquivada</span>
                    </div>
                  </Td>
                  <Td className="text-text-secondary">{account.institution || "—"}</Td>
                  <Td className="text-text-secondary">{accountTypeLabels[account.type]}</Td>
                  <Td className="text-right tabular">{formatCentsToBRL(balances[account.id] ?? 0)}</Td>
                  <Td>
                    <div className="flex justify-end gap-1">
                      <ArchiveAccountButton accountId={account.id} isArchived={true} />
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
