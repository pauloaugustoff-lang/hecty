"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { renameSpaceAction, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: ActionState = {};

export function RenameSpaceForm({ spaceId, currentName }: { spaceId: string; currentName: string }) {
  const boundAction = renameSpaceAction.bind(null, spaceId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);

  useEffect(() => {
    if (state.success) toast.success("Espaço renomeado");
  }, [state]);

  return (
    <form action={formAction} className="flex items-end gap-2">
      <div className="flex-1">
        <Label htmlFor="name">Nome do espaço</Label>
        <Input id="name" name="name" defaultValue={currentName} required />
      </div>
      <Button type="submit" variant="secondary" disabled={isPending}>
        {isPending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
