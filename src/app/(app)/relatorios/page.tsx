import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { getMonthlySeries, getExpenseBreakdown } from "@/lib/data/dashboard";
import { getRecurringExpenses } from "@/lib/data/reports";
import { formatCentsToBRL } from "@/lib/money/money";
import { PageHeader } from "@/components/layout/page-header";
import { RevenueExpenseChart } from "@/components/dashboard/charts";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Repeat } from "lucide-react";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";

export default async function RelatoriosPage() {
  const space = await requireCurrentSpace();
  const now = new Date();

  const currentFrom = format(startOfMonth(now), "yyyy-MM-dd");
  const currentTo = format(endOfMonth(now), "yyyy-MM-dd");
  const prevMonth = subMonths(now, 1);
  const prevFrom = format(startOfMonth(prevMonth), "yyyy-MM-dd");
  const prevTo = format(endOfMonth(prevMonth), "yyyy-MM-dd");

  const [series, currentBreakdown, prevBreakdown, recurring] = await Promise.all([
    getMonthlySeries(space.id, 12),
    getExpenseBreakdown(space.id, currentFrom, currentTo),
    getExpenseBreakdown(space.id, prevFrom, prevTo),
    getRecurringExpenses(space.id),
  ]);

  const prevByCategory = new Map(prevBreakdown.map((c) => [c.categoryId, c.amountCents]));
  const variations = currentBreakdown
    .map((c) => ({
      name: c.name,
      current: c.amountCents,
      previous: prevByCategory.get(c.categoryId) ?? 0,
      delta: c.amountCents - (prevByCategory.get(c.categoryId) ?? 0),
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <PageHeader title="Relatórios" description="Análises complementares ao painel principal." />

      <section className="rounded-[var(--radius-lg)] border border-border-subtle p-6">
        <h2 className="mb-1 font-display text-base font-medium text-text-primary">Evolução de receitas e despesas</h2>
        <p className="mb-3 text-[13px] text-text-secondary">Últimos 12 meses.</p>
        <RevenueExpenseChart data={series} />
      </section>

      <section className="rounded-[var(--radius-lg)] border border-border-subtle p-6">
        <h2 className="mb-1 font-display text-base font-medium text-text-primary">Maiores variações por categoria</h2>
        <p className="mb-3 text-[13px] text-text-secondary">Comparação do mês atual com o anterior.</p>
        {variations.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-tertiary">Sem dados suficientes ainda.</p>
        ) : (
          <div className="space-y-2">
            {variations.map((v) => (
              <div key={v.name} className="flex items-center justify-between border-b border-border-subtle py-2 text-sm last:border-0">
                <span className="text-text-primary">{v.name}</span>
                <span className="flex items-center gap-3 tabular">
                  <span className="text-text-tertiary">{formatCentsToBRL(v.previous)}</span>
                  <span>→</span>
                  <span className="text-text-primary">{formatCentsToBRL(v.current)}</span>
                  <span className={v.delta > 0 ? "text-negative" : "text-positive"}>
                    {v.delta > 0 ? "+" : ""}
                    {formatCentsToBRL(v.delta)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[var(--radius-lg)] border border-border-subtle p-6">
        <h2 className="mb-1 font-display text-base font-medium text-text-primary">Despesas recorrentes</h2>
        <p className="mb-3 text-[13px] text-text-secondary">Descrições que aparecem em pelo menos 3 dos últimos 6 meses.</p>
        {recurring.length === 0 ? (
          <EmptyState icon={Repeat} title="Nenhum padrão recorrente identificado ainda" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Descrição</Th>
                <Th className="text-center">Meses</Th>
                <Th className="text-right">Média</Th>
                <Th className="text-right">Último valor</Th>
              </Tr>
            </Thead>
            <Tbody>
              {recurring.map((r) => (
                <Tr key={r.normalizedDescription}>
                  <Td>{r.sampleDescription}</Td>
                  <Td className="text-center tabular">{r.monthsPresent}</Td>
                  <Td className="text-right tabular">{formatCentsToBRL(r.averageCents)}</Td>
                  <Td className="text-right tabular">{formatCentsToBRL(r.lastAmountCents)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </section>
    </div>
  );
}
