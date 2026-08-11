"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, format, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";

export function PeriodFilter({ month }: { month: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Construído a partir da string (não recebido como Date do servidor) para evitar
  // que a serialização pela fronteira servidor/cliente reinterprete o instante UTC
  // no fuso horário local do navegador, deslocando o mês exibido.
  const [year, monthNum] = month.split("-").map(Number);
  const current = new Date(year, monthNum - 1, 1);

  function go(next: Date) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mes", format(next, "yyyy-MM"));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-border px-1 py-1">
      <Button variant="ghost" size="icon" onClick={() => go(subMonths(current, 1))} aria-label="Mês anterior">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-32 text-center text-sm font-medium capitalize text-text-primary">
        {format(current, "MMMM 'de' yyyy", { locale: ptBR })}
      </span>
      <Button variant="ghost" size="icon" onClick={() => go(addMonths(current, 1))} aria-label="Próximo mês">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
