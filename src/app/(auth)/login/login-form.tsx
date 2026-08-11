"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signInAction, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Callout } from "@/components/ui/callout";

const initialState: ActionState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signInAction, initialState);
  const searchParams = useSearchParams();
  const proximo = searchParams.get("proximo") ?? "/visao-geral";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-xl font-medium text-text-primary">Entrar</h1>
        <p className="text-sm text-text-secondary">Acesse seus espaços financeiros.</p>
      </div>

      {state.error ? <Callout tone="danger">{state.error}</Callout> : null}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="proximo" value={proximo} />
        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required placeholder="voce@exemplo.com" />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link href="/recuperar-senha" className="mb-1.5 text-[13px] text-accent hover:underline">
              Esqueceu a senha?
            </Link>
          </div>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={isPending}>
          {isPending ? "Entrando…" : "Entrar"}
        </Button>
      </form>

      <p className="text-center text-sm text-text-secondary">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="text-accent hover:underline">
          Cadastre-se
        </Link>
      </p>
    </div>
  );
}
