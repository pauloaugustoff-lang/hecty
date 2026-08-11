import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border px-6 py-14 text-center",
        className,
      )}
    >
      {Icon ? <Icon className="h-6 w-6 text-text-tertiary" strokeWidth={1.5} /> : null}
      <div className="space-y-1">
        <p className="font-display text-base text-text-primary">{title}</p>
        {description ? <p className="max-w-sm text-sm text-text-secondary">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
