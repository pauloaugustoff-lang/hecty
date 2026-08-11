import { cn } from "@/lib/utils/cn";

type Tone = "positive" | "negative" | "pending" | "transfer" | "neutral";

const toneClasses: Record<Tone, string> = {
  positive: "bg-positive-soft text-positive",
  negative: "bg-negative-soft text-negative",
  pending: "bg-pending-soft text-pending",
  transfer: "bg-transfer-soft text-transfer",
  neutral: "bg-surface-sunken text-text-secondary",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[11px] font-medium leading-none tracking-wide",
        toneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
