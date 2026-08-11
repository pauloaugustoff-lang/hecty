"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { togglePublicSignupAction } from "./actions";
import { Switch } from "@/components/ui/switch";

export function PublicSignupToggle({ enabled }: { enabled: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(checked: boolean) {
    startTransition(async () => {
      const result = await togglePublicSignupAction(checked);
      if (result.error) toast.error(result.error);
      else toast.success(checked ? "Cadastro público habilitado" : "Cadastro público desabilitado");
    });
  }

  return <Switch checked={enabled} onCheckedChange={handleChange} disabled={isPending} />;
}
