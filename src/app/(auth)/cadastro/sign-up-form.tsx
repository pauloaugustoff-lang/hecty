"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signUpAction, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Callout } from "@/components/ui/callout";

const initialState: ActionState = {};

export function SignUpForm() {
  const [state, formAction, isPending] = useActionState(signUpAction, initialState);
  const searchParams = useSearchParams();
  const proximo = searchParams.get("proximo") ?? "/visao-geral";

  return (
    <div className="space-y-4">
      {state.error ? <Callout tone="danger">{state.error}</Callout> : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="proximo" value={proximo} />
        <div>
          <Label htmlFor="fullName">Nome completo</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required placeholder="Seu nome" />
        </div>
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="voce@exemplo.com" />
        </div>
        <div>
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
          <p className="mt-1 text-xs text-text-tertiary">Mínimo de 8 caracteres.</p>
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isPending}>
          {isPending ? "Criando conta…" : "Criar conta"}
        </Button>
      </form>
    </div>
  );
}
