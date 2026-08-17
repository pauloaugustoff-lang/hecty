import Link from "next/link";
import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/layout/page-header";
import { Callout } from "@/components/ui/callout";
import { ChevronRight, Tag, Tags, Users } from "lucide-react";
import { RenameSpaceForm } from "./rename-space-form";
import { PublicSignupToggle } from "./public-signup-toggle";
import { DemoDataButton } from "./demo-data-button";

export default async function ConfiguracoesPage() {
  const space = await requireCurrentSpace();
  const supabase = await createClient();

  const [{ data: settings }, { data: memberRow }] = await Promise.all([
    supabase.from("app_settings").select("public_signup_enabled").single(),
    supabase.from("space_members").select("role").eq("space_id", space.id).limit(1).maybeSingle(),
  ]);

  const isOwner = memberRow?.role === "proprietario";

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Configurações" />

      <section className="space-y-3">
        <h2 className="font-display text-base font-medium text-text-primary">Espaço financeiro</h2>
        <RenameSpaceForm spaceId={space.id} currentName={space.name} />
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-base font-medium text-text-primary">Navegação rápida</h2>
        <div className="divide-y divide-border-subtle rounded-[var(--radius-lg)] border border-border-subtle">
          <Link href="/configuracoes/categorias" className="flex items-center justify-between px-4 py-3 text-sm hover:bg-surface-sunken">
            <span className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-text-tertiary" /> Categorias
            </span>
            <ChevronRight className="h-4 w-4 text-text-tertiary" />
          </Link>
          <Link href="/configuracoes/tags" className="flex items-center justify-between px-4 py-3 text-sm hover:bg-surface-sunken">
            <span className="flex items-center gap-2">
              <Tags className="h-4 w-4 text-text-tertiary" /> Tags
            </span>
            <ChevronRight className="h-4 w-4 text-text-tertiary" />
          </Link>
          <Link href="/configuracoes/membros" className="flex items-center justify-between px-4 py-3 text-sm hover:bg-surface-sunken">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4 text-text-tertiary" /> Membros e convites
            </span>
            <ChevronRight className="h-4 w-4 text-text-tertiary" />
          </Link>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-base font-medium text-text-primary">Dados de demonstração</h2>
        <p className="text-sm text-text-secondary">
          Cria um novo espaço financeiro separado, marcado como demonstração, com contas, cartão, categorias e
          lançamentos fictícios — incluindo um exemplo de resgate decomposto em principal e rendimento.
        </p>
        <DemoDataButton />
      </section>

      {isOwner ? (
        <section className="space-y-3">
          <h2 className="font-display text-base font-medium text-text-primary">Cadastro público</h2>
          <p className="text-sm text-text-secondary">
            Quando desativado, novas contas só podem ser criadas por convite de um membro existente.
          </p>
          <div className="flex items-center gap-3">
            <PublicSignupToggle enabled={settings?.public_signup_enabled ?? true} />
            <span className="text-sm text-text-secondary">
              {settings?.public_signup_enabled ? "Cadastro público habilitado" : "Somente por convite"}
            </span>
          </div>
          <Callout tone="info">
            Esta configuração é global. Para reforço adicional, você também pode desativar &quot;Enable email
            signups&quot; nas configurações de Auth do seu projeto Supabase.
          </Callout>
        </section>
      ) : null}
    </div>
  );
}
