"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { removeMemberAction, changeMemberRoleAction } from "../actions";
import type { MemberRole } from "@/lib/supabase/types";
import { memberRoleLabels } from "@/lib/domain/labels";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export function MemberRowActions({ memberId, role, isSelf }: { memberId: string; role: MemberRole; isSelf: boolean }) {
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(newRole: string) {
    startTransition(async () => {
      await changeMemberRoleAction(memberId, newRole as MemberRole);
      toast.success("Papel atualizado");
    });
  }

  function handleRemove() {
    if (!confirm("Remover este membro do espaço?")) return;
    startTransition(async () => {
      await removeMemberAction(memberId);
      toast.success("Membro removido");
    });
  }

  if (role === "proprietario") {
    return <span className="text-[13px] text-text-tertiary">{memberRoleLabels[role]}</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={role} onValueChange={handleRoleChange}>
        <SelectTrigger className="h-8 w-36 text-[13px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(memberRoleLabels) as MemberRole[])
            .filter((r) => r !== "proprietario")
            .map((r) => (
              <SelectItem key={r} value={r}>
                {memberRoleLabels[r]}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
      {!isSelf ? (
        <Button variant="ghost" size="sm" onClick={handleRemove} disabled={isPending}>
          Remover
        </Button>
      ) : null}
    </div>
  );
}
