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
  ReferenceLine,
} from "recharts";
import { ChevronRight, ChevronsUpDown } from "lucide-react";
import { formatCentsToBRL } from "@/lib/money/money";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { MonthlyPoint, CategoryBreakdownPoint, MonthlyCategorySeries } from "@/lib/data/dashboard";

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

// Tooltip da pilha mensal: só as categorias com valor no mês (uma pilha de
// 8 categorias onde 5 estão zeradas naquele mês viraria ruído) + o total.
function StackedCategoryTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const nonZero = payload.filter((entry) => entry.value > 0);
  if (nonZero.length === 0) return null;
  const total = nonZero.reduce((sum, entry) => sum + entry.value, 0);
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface-overlay px-3 py-2 text-xs shadow-[var(--shadow-md)]">
      {label ? <p className="mb-1 font-medium capitalize text-text-primary">{label}</p> : null}
      {nonZero.map((entry) => (
        <p key={entry.name} className="flex items-center gap-1.5 text-text-secondary">
          <span className="inline-block h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: entry.color }} />
          {entry.name}: <span className="tabular text-text-primary">{formatCentsToBRL(entry.value)}</span>
        </p>
      ))}
      <p className="mt-1 border-t border-border-subtle pt-1 font-medium text-text-primary">
        Total: <span className="tabular">{formatCentsToBRL(total)}</span>
      </p>
    </div>
  );
}

// Mesmo teto do painel "por categoria": acima disso a pilha vira confete
// ilegível — o excedente agrega em "Outras". Só vale pra visão empilhada;
// no seletor de análise isolada TODAS as categorias aparecem.
const MAX_STACKED_CATEGORIES = 7;
const STACKED_OTHERS_ID = "__outras__";

export function CategoryMonthlyChart({
  expenses,
  revenues,
}: {
  expenses: MonthlyCategorySeries;
  revenues: MonthlyCategorySeries;
}) {
  const [kind, setKind] = useState<"despesa" | "receita">("despesa");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const series = kind === "despesa" ? expenses : revenues;

  function switchKind(next: "despesa" | "receita") {
    setKind(next);
    // As categorias de despesa não existem na série de receita (e vice-versa).
    setSelectedId(null);
  }

  const hasData = series.points.some((point) => Object.values(point.values).some((v) => v > 0));
  if (!hasData) {
    return (
      <div>
        <KindToggle kind={kind} onChange={switchKind} />
        <p className="py-8 text-center text-sm text-text-tertiary">
          {kind === "despesa" ? "Nenhuma despesa classificada nos últimos meses." : "Nenhuma receita classificada nos últimos meses."}
        </p>
      </div>
    );
  }

  // Ids de categoria e subcategoria vêm todos da mesma tabela, então nunca
  // colidem — a seleção resolve primeiro como categoria, depois como sub.
  let isolated: { name: string; color: string; data: { label: string; valor: number }[] } | null = null;
  if (selectedId) {
    const category = series.categories.find((c) => c.id === selectedId);
    if (category) {
      isolated = {
        name: category.name,
        color: category.color,
        data: series.points.map((p) => ({ label: p.label, valor: p.values[category.id] ?? 0 })),
      };
    } else {
      for (const parent of series.categories) {
        const sub = parent.subcategories.find((s) => s.id === selectedId);
        if (sub) {
          isolated = {
            name: `${parent.name} › ${sub.name}`,
            color: sub.color,
            data: series.points.map((p) => ({ label: p.label, valor: p.subValues[sub.id] ?? 0 })),
          };
          break;
        }
      }
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <KindToggle kind={kind} onChange={switchKind} />
        <Select value={selectedId ?? "todas"} onValueChange={(v) => setSelectedId(v === "todas" ? null : v)}>
          <SelectTrigger className="w-64" aria-label="Analisar uma categoria ou subcategoria isoladamente">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as categorias</SelectItem>
            {series.categories.flatMap((category) => [
              <SelectItem key={category.id} value={category.id}>
                <span className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: category.color }} />
                  {category.name}
                </span>
              </SelectItem>,
              ...category.subcategories.map((sub) => (
                <SelectItem key={sub.id} value={sub.id}>
                  <span className="flex items-center gap-2 pl-4">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: sub.color }} />
                    {sub.name}
                  </span>
                </SelectItem>
              )),
            ])}
          </SelectContent>
        </Select>
      </div>

      {isolated ? (
        <IsolatedCategoryChart name={isolated.name} color={isolated.color} data={isolated.data} />
      ) : (
        <StackedCategoryChart series={series} onSelectCategory={setSelectedId} />
      )}
    </div>
  );
}

function KindToggle({ kind, onChange }: { kind: "despesa" | "receita"; onChange: (kind: "despesa" | "receita") => void }) {
  return (
    <div className="inline-flex rounded-[var(--radius-md)] border border-border p-0.5">
      {(
        [
          ["despesa", "Despesas"],
          ["receita", "Receitas"],
        ] as const
      ).map(([value, text]) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          className={`rounded-[calc(var(--radius-md)-2px)] px-3 py-1 text-xs font-medium transition-colors ${
            kind === value ? "bg-accent-soft text-accent" : "text-text-tertiary hover:text-text-secondary"
          }`}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

function StackedCategoryChart({
  series,
  onSelectCategory,
}: {
  series: MonthlyCategorySeries;
  onSelectCategory: (categoryId: string) => void;
}) {
  const visible = series.categories.slice(0, MAX_STACKED_CATEGORIES);
  const folded = series.categories.slice(MAX_STACKED_CATEGORIES);
  const foldedIds = new Set(folded.map((c) => c.id));
  const stackCategories =
    folded.length > 0 ? [...visible, { id: STACKED_OTHERS_ID, name: "Outras", color: "#94a3b8" }] : visible;

  // Recharts espera chaves planas por série, com zero explícito nos meses em
  // que a categoria não aparece (undefined quebraria o empilhamento).
  const data = series.points.map((point) => {
    const row: Record<string, number | string> = { label: point.label };
    for (const category of stackCategories) row[category.id] = 0;
    for (const [id, cents] of Object.entries(point.values)) {
      const key = foldedIds.has(id) ? STACKED_OTHERS_ID : id;
      row[key] = (row[key] as number) + cents;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid vertical={false} stroke={gridColor} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: textColor, fontSize: 12 }} className="capitalize" />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: textColor, fontSize: 11 }}
          tickFormatter={(v) => formatCentsToBRL(v).replace(/ /g, " ")}
          width={72}
        />
        <Tooltip content={<StackedCategoryTooltip />} cursor={{ fill: "var(--surface-sunken)" }} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: textColor, cursor: "pointer" }}
          // Clicar numa categoria da legenda também isola ("Outras" não é uma
          // categoria real, então não isola).
          onClick={(entry) => {
            const id = String(entry.dataKey ?? "");
            if (id && id !== STACKED_OTHERS_ID) onSelectCategory(id);
          }}
        />
        {stackCategories.map((category) => (
          <Bar
            key={category.id}
            dataKey={category.id}
            name={category.name}
            stackId="meses"
            fill={category.color}
            // Respiro entre os segmentos da pilha, na cor do cartão.
            stroke="var(--surface-raised)"
            strokeWidth={1}
            maxBarSize={56}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function IsolatedCategoryChart({
  name,
  color,
  data,
}: {
  name: string;
  color: string;
  data: { label: string; valor: number }[];
}) {
  const totalCents = data.reduce((sum, d) => sum + d.valor, 0);
  const averageCents = data.length > 0 ? Math.round(totalCents / data.length) : 0;

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid vertical={false} stroke={gridColor} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: textColor, fontSize: 12 }} className="capitalize" />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: textColor, fontSize: 11 }}
            tickFormatter={(v) => formatCentsToBRL(v).replace(/ /g, " ")}
            width={72}
          />
          <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "var(--surface-sunken)" }} />
          <ReferenceLine y={averageCents} stroke="var(--border-strong)" strokeDasharray="4 4" />
          <Bar dataKey="valor" name={name} fill={color} radius={[3, 3, 0, 0]} maxBarSize={56} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[13px] text-text-secondary">
        <span className="mr-1 inline-block h-2 w-2 rounded-[2px]" style={{ backgroundColor: color }} />
        {name}: média de <span className="tabular font-medium text-text-primary">{formatCentsToBRL(averageCents)}</span>/mês
        {" · "}total de <span className="tabular font-medium text-text-primary">{formatCentsToBRL(totalCents)}</span> no período
        <span className="text-text-tertiary"> (linha tracejada = média)</span>
      </p>
    </div>
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
