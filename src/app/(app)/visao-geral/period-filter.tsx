"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";

export function PeriodFilter({ month }: { month: Date }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(next: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mes", format(next, "yyyy-MM"));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-border px-1 py-1">
      <Button variant="ghost" size="icon" onClick={() => go(subMonths(month, 1))} aria-label="Mês anterior">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-32 text-center text-sm font-medium capitalize text-text-primary">
        {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
      </span>
      <Button variant="ghost" size="icon" onClick={() => go(addMonths(month, 1))} aria-label="Próximo mês">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
