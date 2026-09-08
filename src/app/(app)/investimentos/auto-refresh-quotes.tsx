"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, CloudOff } from "lucide-react";
import { refreshMarketDataAction } from "./actions";

/**
 * Atualização automática das cotações ao abrir a carteira.
 *
 * A busca NÃO acontece durante a renderização da página: se acontecesse, abrir
 * Investimentos ficaria refém do Yahoo e do Banco Central responderem, e um
 * provedor lento viraria uma página travada. Em vez disso a página abre na hora
 * com o que está em cache e este componente dispara a atualização em segundo
 * plano, só quando o servidor disse que o cache está velho (`needsRefresh`).
 *
 * Quando termina, o revalidatePath da própria action redesenha a página com os
 * preços novos e `needsRefresh` volta a ser falso — o que também é o que impede
 * o ciclo de se repetir. O ref é a trava para o caso de a busca falhar: aí
 * `needsRefresh` continua verdadeiro, e sem ele a tentativa se repetiria a cada
 * redesenho.
 */
export function AutoRefreshQuotes({ spaceId, needsRefresh }: { spaceId: string; needsRefresh: boolean }) {
  const alreadyTried = useRef(false);
  const [status, setStatus] = useState<"idle" | "running" | "failed">("idle");

  useEffect(() => {
    if (!needsRefresh || alreadyTried.current) return;
    alreadyTried.current = true;

    let active = true;
    setStatus("running");
    refreshMarketDataAction(spaceId)
      .then((result) => {
        if (!active) return;
        setStatus(result.error ? "failed" : "idle");
      })
      .catch(() => {
        if (active) setStatus("failed");
      });

    return () => {
      active = false;
    };
  }, [needsRefresh, spaceId]);

  if (status === "running") {
    return (
      <p className="flex items-center gap-1.5 text-[12px] text-text-tertiary">
        <Loader2 className="h-3 w-3 animate-spin" /> Atualizando cotações…
      </p>
    );
  }

  // Falha silenciosa seria pior: os números continuariam na tela parecendo
  // atuais. Aqui não é um toast — quem só quer olhar a carteira com o provedor
  // fora do ar não precisa de um alarme a cada visita.
  if (status === "failed") {
    return (
      <p className="flex items-center gap-1.5 text-[12px] text-pending">
        <CloudOff className="h-3 w-3" /> Não consegui atualizar as cotações agora; os valores abaixo são os do último
        preço conhecido.
      </p>
    );
  }

  return null;
}
