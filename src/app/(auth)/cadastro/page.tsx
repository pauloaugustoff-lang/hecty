import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Callout } from "@/components/ui/callout";
import { SignUpForm } from "./sign-up-form";

export default async function CadastroPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase.from("app_settings").select("public_signup_enabled").single();
  const signupEnabled = settings?.public_signup_enabled ?? true;

  if (!signupEnabled) {
    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="font-display text-xl font-medium text-text-primary">Cadastro fechado</h1>
        </div>
        <Callout tone="info">
          O cadastro público está desativado no momento. Peça a um administrador de um espaço financeiro para te
          convidar por e-mail.
        </Callout>
        <p className="text-center text-sm text-text-secondary">
          Já tem uma conta?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-xl font-medium text-text-primary">Criar conta</h1>
        <p className="text-sm text-text-secondary">Seu espaço financeiro pessoal é criado automaticamente.</p>
      </div>
      <Suspense>
        <SignUpForm />
      </Suspense>
      <p className="text-center text-sm text-text-secondary">
        Já tem uma conta?{" "}
        <Link href="/login" className="text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
