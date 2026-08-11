import { Suspense } from "react";
import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { getDashboardMetrics, getMonthlySeries, getExpenseBreakdown } from "@/lib/data/dashboard";
import { formatCentsToBRL } from "@/lib/money/money";
import { PageHeader } from "@/components/layout/page-header";
import { KpiBand, type KpiItem } from "@/components/dashboard/kpi-band";
import { RevenueExpenseChart, CashFlowChart, ExpenseByCategoryChart } from "@/components/dashboard/charts";
import { Callout } from "@/components/ui/callout";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import Link from "next/link";
import { PeriodFilter } from "./period-filter";

export default async function VisaoGeralPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes } = await searchParams;
  const space = await requireCurrentSpace();

  const month = mes ? new Date(`${mes}-01T00:00:00`) : new Date();
  const from = format(startOfMonth(month), "yyyy-MM-dd");
  const to = format(endOfMonth(month), "yyyy-MM-dd");

  const prevMonth = subMonths(month, 1);
  const prevFrom = format(startOfMonth(prevMonth), "yyyy-MM-dd");
  const prevTo = format(endOfMonth(prevMonth), "yyyy-MM-dd");

  const [metrics, prevMetrics, monthlySeries, expenseBreakdown] = await Promise.all([
    getDashboardMetrics(space.id, from, to),
    getDashboardMetrics(space.id, prevFrom, prevTo),
    getMonthlySeries(space.id, 6),
    getExpenseBreakdown(space.id, from, to),
  ]);

  function delta(current: number, previous: number): string | undefined {
    if (previous === 0) return undefined;
    const pct = ((current - previous) / Math.abs(previous)) * 100;
    const sign = pct > 0 ? "+" : "";
    return `${sign}${pct.toFixed(0)}% vs. mês anterior`;
  }

  const kpis: KpiItem[] = [
    { label: "Entradas de caixa", valueCents: metrics.entradasCaixaCents, tone: "neutral" },
    { label: "Receitas efetivas", valueCents: metrics.receitasEfetivasCents, tone: "positive", hint: delta(metrics.receitasEfetivasCents, prevMetrics.receitasEfetivasCents) },
    { label: "Despesas", valueCents: metrics.despesasCents, tone: "negative", hint: delta(metrics.despesasCents, prevMetrics.despesasCents) },
    { label: "Resultado econômico", valueCents: metrics.resultadoEconomicoCents, tone: metrics.resultadoEconomicoCents >= 0 ? "positive" : "negative" },
    { label: "Rendimentos líquidos", valueCents: metrics.rendimentosLiquidosCents, tone: "positive" },
    { label: "Capital consumido", valueCents: metrics.capitalConsumidoCents, tone: metrics.capitalConsumidoCents > 0 ? "negative" : "neutral" },
  ];

  const coveragePct = metrics.percentualDespesasCobertasPorRendimentos;

  return (
    <div>
      <PageHeader
        title="Visão geral"
        description="Resumo do espaço financeiro no período selecionado."
        actions={
          <Suspense>
            <PeriodFilter month={month} />
          </Suspense>
        }
      />

      {metrics.temDadosIncompletos ? (
        <Callout tone="warning" className="mb-6">
          {metrics.transacoesPendentesClassificacao > 0 ? (
            <>
              {metrics.transacoesPendentesClassificacao} lançamento(s) ainda não classificado(s).{" "}
            </>
          ) : null}
          {metrics.resgatesPendentesDecomposicao > 0 ? (
            <>{metrics.resgatesPendentesDecomposicao} resgate(s) de investimento aguardando decomposição. </>
          ) : null}
          Os indicadores abaixo podem estar incompletos.{" "}
          <Link href="/revisar" className="font-medium underline">
            Revisar agora
          </Link>
        </Callout>
      ) : null}

      <KpiBand items={kpis} />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-[var(--radius-lg)] border border-border-subtle p-6 lg:col-span-2">
          <h2 className="mb-1 font-display text-base font-medium text-text-primary">Receitas efetivas vs. despesas</h2>
          <p className="mb-3 text-[13px] text-text-secondary">Os rendimentos estão cobrindo as despesas?</p>
          <RevenueExpenseChart data={monthlySeries} />
          {coveragePct !== null ? (
            <p className="mt-2 text-[13px] text-text-secondary">
              Rendimentos líquidos cobriram{" "}
              <span className={coveragePct >= 1 ? "font-medium text-positive" : "font-medium text-pending"}>
                {(coveragePct * 100).toFixed(0)}%
              </span>{" "}
              das despesas do período.
            </p>
          ) : null}
        </div>

        <div className="rounded-[var(--radius-lg)] border border-border-subtle p-6">
          <h2 className="mb-1 font-display text-base font-medium text-text-primary">Gastos por categoria</h2>
          <p className="mb-3 text-[13px] text-text-secondary">Onde o dinheiro foi gasto no período.</p>
          <ExpenseByCategoryChart data={expenseBreakdown} />
        </div>

        <div className="rounded-[var(--radius-lg)] border border-border-subtle p-6 lg:col-span-2">
          <h2 className="mb-1 font-display text-base font-medium text-text-primary">Fluxo de caixa (resultado mensal)</h2>
          <p className="mb-3 text-[13px] text-text-secondary">Evolução do resultado econômico nos últimos 6 meses.</p>
          <CashFlowChart data={monthlySeries} />
        </div>

        <div className="rounded-[var(--radius-lg)] border border-border-subtle p-6">
          <h2 className="mb-3 font-display text-base font-medium text-text-primary">Composição das entradas</h2>
          <dl className="space-y-3 text-[13px]">
            <div className="flex justify-between border-b border-border-subtle pb-2">
              <dt className="text-text-secondary">Receita efetiva</dt>
              <dd className="tabular font-medium text-positive">{formatCentsToBRL(metrics.receitasEfetivasCents)}</dd>
            </div>
            <div className="flex justify-between border-b border-border-subtle pb-2">
              <dt className="text-text-secondary">Retorno de principal</dt>
              <dd className="tabular font-medium text-transfer">{formatCentsToBRL(metrics.resgatesPrincipalCents)}</dd>
            </div>
            <div className="flex justify-between pb-1">
              <dt className="text-text-secondary">Total de entradas de caixa</dt>
              <dd className="tabular font-medium text-text-primary">{formatCentsToBRL(metrics.entradasCaixaCents)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
