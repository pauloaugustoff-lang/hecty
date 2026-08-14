"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { inviteMemberAction, type ActionState } from "../actions";
import { memberRoleLabels, memberRoleDescriptions } from "@/lib/domain/labels";
import type { MemberRole } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Callout } from "@/components/ui/callout";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

const initialState: ActionState = {};

export function InviteForm({ spaceId }: { spaceId: string }) {
  const boundAction = inviteMemberAction.bind(null, spaceId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const [role, setRole] = useState<MemberRole>("editor");

  useEffect(() => {
    if (state.success) toast.success("Convite enviado");
  }, [state]);

  return (
    <div className="space-y-3 rounded-[var(--radius-lg)] border border-border-subtle p-4">
      {state.error ? <Callout tone="danger">{state.error}</Callout> : null}
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="role" value={role} />
        <div className="flex-1 min-w-48">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" required placeholder="pessoa@exemplo.com" />
        </div>
        <div className="w-52">
          <Label htmlFor="role">Papel</Label>
          <Select value={role} onValueChange={(v) => setRole(v as MemberRole)}>
            <SelectTrigger id="role">
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
        </div>
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Enviando…" : "Convidar"}
        </Button>
      </form>
      <p className="text-[12px] text-text-tertiary">{memberRoleDescriptions[role]}</p>
    </div>
  );
}
