"use client";

import { useTransition } from "react";
import { toggleRuleActiveAction } from "./actions";
import { Switch } from "@/components/ui/switch";

export function ToggleActiveSwitch({ ruleId, isActive }: { ruleId: string; isActive: boolean }) {
  const [, startTransition] = useTransition();

  return (
    <Switch
      checked={isActive}
      onCheckedChange={(checked) => startTransition(() => toggleRuleActiveAction(ruleId, checked))}
      aria-label={isActive ? "Desativar regra" : "Ativar regra"}
    />
  );
}
