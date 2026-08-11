"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function AcceptInviteButton({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function accept() {
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.rpc("accept_space_invite", { p_token: token });

      if (error) {
        toast.error("Não foi possível aceitar o convite", { description: error.message });
        return;
      }

      toast.success("Convite aceito");
      router.push("/visao-geral");
      router.refresh();
    });
  }

  return (
    <Button variant="primary" size="lg" className="w-full" onClick={accept} disabled={isPending}>
      {isPending ? "Aceitando…" : "Aceitar convite"}
    </Button>
  );
}
