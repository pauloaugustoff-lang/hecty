"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { revokeInviteAction } from "../actions";
import { Button } from "@/components/ui/button";

export function RevokeInviteButton({ inviteId }: { inviteId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await revokeInviteAction(inviteId);
      toast.success("Convite revogado");
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={isPending}>
      Revogar
    </Button>
  );
}
