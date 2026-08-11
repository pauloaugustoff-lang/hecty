import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Tone = "info" | "success" | "warning" | "danger";

const toneConfig: Record<Tone, { icon: typeof Info; classes: string }> = {
  info: { icon: Info, classes: "bg-transfer-soft text-transfer border-transparent" },
  success: { icon: CheckCircle2, classes: "bg-positive-soft text-positive border-transparent" },
  warning: { icon: AlertTriangle, classes: "bg-pending-soft text-pending border-transparent" },
  danger: { icon: XCircle, classes: "bg-negative-soft text-negative border-transparent" },
};

export function Callout({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, classes } = toneConfig[tone];

  return (
    <div className={cn("flex gap-2.5 rounded-[var(--radius-md)] border px-3.5 py-3 text-sm", classes, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
      <div className="space-y-0.5">
        {title ? <p className="font-medium leading-tight">{title}</p> : null}
        <div className="leading-snug opacity-90">{children}</div>
      </div>
    </div>
  );
}
