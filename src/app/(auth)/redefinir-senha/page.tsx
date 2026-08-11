"use client";

import { useActionState } from "react";
import { updatePasswordAction, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Callout } from "@/components/ui/callout";

const initialState: ActionState = {};

export default function RedefinirSenhaPage() {
  const [state, formAction, isPending] = useActionState(updatePasswordAction, initialState);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-xl font-medium text-text-primary">Definir nova senha</h1>
        <p className="text-sm text-text-secondary">Escolha uma nova senha para sua conta.</p>
      </div>

      {state.error ? <Callout tone="danger">{state.error}</Callout> : null}

      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="password">Nova senha</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isPending}>
          {isPending ? "Salvando…" : "Salvar nova senha"}
        </Button>
      </form>
    </div>
  );
}
