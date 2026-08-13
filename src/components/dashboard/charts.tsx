"use client";

import { useState } from "react";
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
import { ChevronRight, ChevronsUpDown } from "lucide-react";
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

const MAX_VISIBLE_CATEGORIES = 8;
const OTHERS_CATEGORY_ID = "__outras__";

type CategoryBreakdownItem = CategoryBreakdownPoint & { nested?: CategoryBreakdownPoint[] };

function hasChildren(item: CategoryBreakdownItem): boolean {
  if (item.nested && item.nested.length > 0) return true;
  return item.subcategories.length > 1 || (item.subcategories.length === 1 && item.subcategories[0].subcategoryId !== "sem-subcategoria");
}

function SubcategoryBars({ parentAmountCents, subcategories }: { parentAmountCents: number; subcategories: CategoryBreakdownPoint["subcategories"] }) {
  return (
    <div className="mb-1 ml-4 mt-2 space-y-2 border-l border-border-subtle pl-3">
      {subcategories.map((sub) => {
        const subPct = parentAmountCents > 0 ? (sub.amountCents / parentAmountCents) * 100 : 0;
        return (
          <div key={sub.subcategoryId}>
            <div className="mb-1 flex items-center justify-between text-[12px]">
              <span className="text-text-secondary">{sub.name}</span>
              <span className="tabular text-text-tertiary">{formatCentsToBRL(sub.amountCents)}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-sunken">
              <div className="h-full rounded-full opacity-70" style={{ width: `${subPct}%`, backgroundColor: sub.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CategoryRow({
  item,
  parentAmountCents,
  expanded,
  onToggle,
}: {
  item: CategoryBreakdownItem;
  parentAmountCents: number;
  expanded: Set<string>;
  onToggle: (categoryId: string) => void;
}) {
  const pct = parentAmountCents > 0 ? (item.amountCents / parentAmountCents) * 100 : 0;
  const expandable = hasChildren(item);
  const isOpen = expanded.has(item.categoryId);

  return (
    <div>
      <button
        type="button"
        onClick={() => expandable && onToggle(item.categoryId)}
        disabled={!expandable}
        className={`w-full text-left ${expandable ? "cursor-pointer" : "cursor-default"}`}
      >
        <div className="mb-1 flex items-center justify-between text-[13px]">
          <span className="flex items-center gap-1 text-text-primary">
            {expandable ? (
              <ChevronRight className={`h-3 w-3 shrink-0 text-text-tertiary transition-transform ${isOpen ? "rotate-90" : ""}`} />
            ) : (
              <span className="w-3" />
            )}
            {item.name}
          </span>
          <span className="tabular text-text-secondary">{formatCentsToBRL(item.amountCents)}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
        </div>
      </button>

      {isOpen && item.nested && item.nested.length > 0 ? (
        <div className="mb-1 ml-4 mt-2 space-y-2 border-l border-border-subtle pl-3">
          {item.nested.map((nestedItem) => (
            <CategoryRow key={nestedItem.categoryId} item={nestedItem} parentAmountCents={item.amountCents} expanded={expanded} onToggle={onToggle} />
          ))}
        </div>
      ) : null}

      {isOpen && !item.nested ? <SubcategoryBars parentAmountCents={item.amountCents} subcategories={item.subcategories} /> : null}
    </div>
  );
}

export function CategoryBreakdownChart({
  data,
  emptyMessage = "Nenhum lançamento classificado no período.",
}: {
  data: CategoryBreakdownPoint[];
  emptyMessage?: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const total = data.reduce((sum, d) => sum + d.amountCents, 0);

  // Categorias além das maiores não somem silenciosamente: viram uma linha
  // "Outras", expansível para revelar as categorias agrupadas ali — e cada
  // uma delas continua expansível pras próprias subcategorias (2º nível).
  let top: CategoryBreakdownItem[];
  if (data.length > MAX_VISIBLE_CATEGORIES) {
    const visible = data.slice(0, MAX_VISIBLE_CATEGORIES - 1);
    const rest = data.slice(MAX_VISIBLE_CATEGORIES - 1);
    top = [
      ...visible,
      {
        categoryId: OTHERS_CATEGORY_ID,
        name: "Outras",
        color: "#94a3b8",
        amountCents: rest.reduce((sum, d) => sum + d.amountCents, 0),
        subcategories: [],
        nested: rest,
      },
    ];
  } else {
    top = data;
  }

  if (top.length === 0) {
    return <p className="py-8 text-center text-sm text-text-tertiary">{emptyMessage}</p>;
  }

  function toggle(categoryId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  const expandableIds = top.filter(hasChildren).map((item) => item.categoryId);
  const allExpanded = expandableIds.length > 0 && expandableIds.every((id) => expanded.has(id));

  function toggleAll() {
    setExpanded(allExpanded ? new Set() : new Set(expandableIds));
  }

  return (
    <div className="space-y-2.5">
      {expandableIds.length > 0 ? (
        <button
          type="button"
          onClick={toggleAll}
          className="mb-1 flex items-center gap-1 text-[11px] font-medium text-text-tertiary hover:text-text-secondary"
        >
          <ChevronsUpDown className="h-3 w-3" />
          {allExpanded ? "Recolher todas" : "Expandir todas"}
        </button>
      ) : null}
      {top.map((item) => (
        <CategoryRow key={item.categoryId} item={item} parentAmountCents={total} expanded={expanded} onToggle={toggle} />
      ))}
    </div>
  );
}
