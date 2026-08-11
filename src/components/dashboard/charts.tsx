"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { formatCentsToBRL } from "@/lib/money/money";
import type { MonthlyPoint, CategoryBreakdownPoint } from "@/lib/data/dashboard";

const gridColor = "var(--chart-grid)";
const textColor = "var(--text-tertiary)";

function CurrencyTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface-overlay px-3 py-2 text-xs shadow-[var(--shadow-md)]">
      {label ? <p className="mb-1 font-medium text-text-primary">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }} className="tabular">
          {entry.name}: {formatCentsToBRL(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function RevenueExpenseChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} barGap={4}>
        <CartesianGrid vertical={false} stroke={gridColor} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: textColor, fontSize: 12 }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: textColor, fontSize: 11 }}
          tickFormatter={(v) => formatCentsToBRL(v).replace(/ /g, " ")}
          width={72}
        />
        <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "var(--surface-sunken)" }} />
        <Legend wrapperStyle={{ fontSize: 12, color: textColor }} />
        <Bar dataKey="receitas" name="Receitas efetivas" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="despesas" name="Despesas" fill="var(--chart-4)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CashFlowChart({ data }: { data: MonthlyPoint[] }) {
  const series = data.map((d) => ({ ...d, resultado: d.receitas - d.despesas }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={series}>
        <CartesianGrid vertical={false} stroke={gridColor} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: textColor, fontSize: 12 }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: textColor, fontSize: 11 }}
          tickFormatter={(v) => formatCentsToBRL(v).replace(/ /g, " ")}
          width={72}
        />
        <Tooltip content={<CurrencyTooltip />} cursor={{ stroke: "var(--border-strong)" }} />
        <Line type="monotone" dataKey="resultado" name="Resultado econômico" stroke="var(--chart-5)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ExpenseByCategoryChart({ data }: { data: CategoryBreakdownPoint[] }) {
  const top = data.slice(0, 8);
  const total = data.reduce((sum, d) => sum + d.amountCents, 0);

  if (top.length === 0) {
    return <p className="py-8 text-center text-sm text-text-tertiary">Nenhuma despesa classificada no período.</p>;
  }

  return (
    <div className="space-y-2.5">
      {top.map((item) => {
        const pct = total > 0 ? (item.amountCents / total) * 100 : 0;
        return (
          <div key={item.categoryId}>
            <div className="mb-1 flex items-center justify-between text-[13px]">
              <span className="text-text-primary">{item.name}</span>
              <span className="tabular text-text-secondary">{formatCentsToBRL(item.amountCents)}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
