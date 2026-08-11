"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { loadDemoDataAction } from "./actions";
import { Button } from "@/components/ui/button";

export function DemoDataButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await loadDemoDataAction();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Espaço de demonstração criado");
      router.refresh();
    });
  }

  return (
    <Button variant="secondary" onClick={handleClick} disabled={isPending}>
      <Sparkles className="h-4 w-4" /> {isPending ? "Gerando dados…" : "Carregar dados de demonstração"}
    </Button>
  );
}
