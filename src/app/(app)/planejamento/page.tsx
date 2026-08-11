import { Suspense } from "react";
import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { listCategories } from "@/lib/data/categories";
import { listBudgets, getActualSpendByCategory } from "@/lib/data/budgets";
import { formatCentsToBRL } from "@/lib/money/money";
import { PageHeader } from "@/components/layout/page-header";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { Target } from "lucide-react";
import { MonthFilter } from "./month-filter";
import { BudgetInput } from "./budget-input";
import { endOfMonth, format, startOfMonth } from "date-fns";

export default async function PlanejamentoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  const space = await requireCurrentSpace();
  const monthParam = mes ?? format(new Date(), "yyyy-MM");
  const [monthYear, monthNum] = monthParam.split("-").map(Number);
  const month = new Date(monthYear, monthNum - 1, 1);
  const referenceMonth = format(startOfMonth(month), "yyyy-MM-dd");
  const from = referenceMonth;
  const to = format(endOfMonth(month), "yyyy-MM-dd");

  const [categories, budgets, actuals] = await Promise.all([
    listCategories(space.id),
    listBudgets(space.id, referenceMonth),
    getActualSpendByCategory(space.id, from, to),
  ]);

  const expenseCategories = categories.filter((c) => c.kind === "despesa" && !c.parent_id);
  const budgetByCategory = new Map(budgets.map((b) => [b.category_id, b.planned_amount_cents]));

  const totalPlanned = expenseCategories.reduce((sum, c) => sum + (budgetByCategory.get(c.id) ?? 0), 0);
  const totalActual = expenseCategories.reduce((sum, c) => sum + (actuals[c.id] ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Planejamento"
        description="Defina um valor planejado por categoria e acompanhe o quanto já foi gasto no mês."
        actions={
          <Suspense>
            <MonthFilter month={monthParam} />
          </Suspense>
        }
      />

      {expenseCategories.length === 0 ? (
        <EmptyState icon={Target} title="Nenhuma categoria de despesa" description="Crie categorias de despesa em Configurações para planejar seus gastos." />
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-border-subtle">
          <Table>
            <Thead>
              <Tr>
                <Th>Categoria</Th>
                <Th className="text-right">Planejado</Th>
                <Th className="text-right">Realizado</Th>
                <Th>Progresso</Th>
              </Tr>
            </Thead>
            <Tbody>
              {expenseCategories.map((category) => {
                const planned = budgetByCategory.get(category.id) ?? 0;
                const actual = actuals[category.id] ?? 0;
                const pct = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
                const over = planned > 0 && actual > planned;

                return (
                  <Tr key={category.id}>
                    <Td className="font-medium">
                      <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: category.color }} />
                      {category.name}
                    </Td>
                    <Td className="text-right">
                      <BudgetInput spaceId={space.id} categoryId={category.id} referenceMonth={referenceMonth} initialCents={planned} />
                    </Td>
                    <Td className={`text-right tabular ${over ? "text-negative font-medium" : ""}`}>{formatCentsToBRL(actual)}</Td>
                    <Td className="w-48">
                      {planned > 0 ? (
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, backgroundColor: over ? "var(--negative)" : "var(--positive)" }}
                          />
                        </div>
                      ) : (
                        <span className="text-[12px] text-text-tertiary">sem planejamento</span>
                      )}
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
            <tfoot>
              <Tr className="font-medium">
                <Td>Total</Td>
                <Td className="text-right tabular">{formatCentsToBRL(totalPlanned)}</Td>
                <Td className={`text-right tabular ${totalActual > totalPlanned && totalPlanned > 0 ? "text-negative" : ""}`}>
                  {formatCentsToBRL(totalActual)}
                </Td>
                <Td />
              </Tr>
            </tfoot>
          </Table>
        </div>
      )}
    </div>
  );
}
