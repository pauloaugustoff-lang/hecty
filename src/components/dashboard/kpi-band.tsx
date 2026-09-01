import { formatCentsToBRL } from "@/lib/money/money";
import { cn } from "@/lib/utils/cn";

export interface KpiItem {
  label: string;
  valueCents: number;
  tone?: "positive" | "negative" | "neutral";
  hint?: string;
}

export function KpiBand({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-border-subtle rounded-[var(--radius-lg)] border border-border-subtle bg-surface-raised shadow-[var(--shadow-sm)] sm:grid-cols-3 lg:grid-cols-6">
      {items.map((item) => (
        <div key={item.label} className="px-5 py-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">{item.label}</p>
          <p
            className={cn(
              "mt-2 text-[23px] font-semibold tabular",
              item.tone === "positive" && "text-positive",
              item.tone === "negative" && "text-negative",
              (!item.tone || item.tone === "neutral") && "text-text-primary",
            )}
          >
            {formatCentsToBRL(item.valueCents)}
          </p>
          {item.hint ? <p className="mt-1 text-[11px] text-text-tertiary">{item.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
