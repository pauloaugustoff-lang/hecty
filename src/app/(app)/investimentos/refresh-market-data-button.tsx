"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { refreshMarketDataAction } from "./actions";
import { Button } from "@/components/ui/button";

export function RefreshMarketDataButton({ spaceId }: { spaceId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await refreshMarketDataAction(spaceId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      // Falha parcial é o caso comum: um ticker digitado errado não deve
      // parecer falha geral, nem sumir sem que ninguém veja.
      if (result.failed?.length) {
        toast.warning(
          `${result.updated ?? 0} cotação(ões) atualizada(s). Sem preço para: ${result.failed.join(", ")}.`,
        );
        return;
      }

      toast.success(
        result.updated ? `${result.updated} cotação(ões) atualizada(s)` : "Dados de mercado atualizados",
      );
    });
  }

  return (
    <Button variant="secondary" onClick={handleClick} disabled={isPending}>
      <RefreshCw className={isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      {isPending ? "Atualizando…" : "Atualizar cotações"}
    </Button>
  );
}
