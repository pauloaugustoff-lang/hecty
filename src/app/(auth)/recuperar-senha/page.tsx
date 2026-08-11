"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Callout } from "@/components/ui/callout";

const initialState: ActionState = {};

export default function RecuperarSenhaPage() {
  const [state, formAction, isPending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-xl font-medium text-text-primary">Recuperar senha</h1>
        <p className="text-sm text-text-secondary">Enviaremos um link para redefinir sua senha.</p>
      </div>

      {state.error ? <Callout tone="danger">{state.error}</Callout> : null}
      {state.success ? <Callout tone="success">{state.success}</Callout> : null}

      {!state.success ? (
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required placeholder="voce@exemplo.com" />
          </div>
          <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isPending}>
            {isPending ? "Enviando…" : "Enviar link"}
          </Button>
        </form>
      ) : null}

      <p className="text-center text-sm text-text-secondary">
        <Link href="/login" className="text-accent hover:underline">
          Voltar para o login
        </Link>
      </p>
    </div>
  );
}
