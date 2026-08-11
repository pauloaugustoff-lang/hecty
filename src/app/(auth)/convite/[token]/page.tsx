import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { memberRoleLabels } from "@/lib/domain/labels";
import { Callout } from "@/components/ui/callout";
import { Button } from "@/components/ui/button";
import { AcceptInviteButton } from "./accept-invite-button";

export default async function ConvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const [{ data: preview, error }, { data: userData }] = await Promise.all([
    supabase.rpc("get_invite_preview", { p_token: token }).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  const user = userData?.user ?? null;

  if (error || !preview) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-medium text-text-primary">Convite não encontrado</h1>
        <Callout tone="danger">Este link de convite é inválido.</Callout>
      </div>
    );
  }

  if (preview.status === "aceito") {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-medium text-text-primary">Convite já utilizado</h1>
        <Callout tone="info">Este convite já foi aceito anteriormente.</Callout>
        <Button asChild variant="primary" className="w-full">
          <Link href="/visao-geral">Ir para o painel</Link>
        </Button>
      </div>
    );
  }

  if (preview.status === "revogado" || preview.status === "expirado" || new Date(preview.expires_at) < new Date()) {
    return (
      <div className="space-y-4">
        <h1 className="font-display text-xl font-medium text-text-primary">Convite expirado</h1>
        <Callout tone="warning">Peça a quem te convidou para enviar um novo convite.</Callout>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-xl font-medium text-text-primary">Convite para espaço financeiro</h1>
        <p className="text-sm text-text-secondary">
          <strong className="text-text-primary">{preview.invited_by_name}</strong> convidou você para o espaço{" "}
          <strong className="text-text-primary">{preview.space_name}</strong> como{" "}
          <strong className="text-text-primary">{memberRoleLabels[preview.role]}</strong>.
        </p>
      </div>

      {!user ? (
        <div className="space-y-3">
          <Callout tone="info">Entre ou crie uma conta com o e-mail convidado para aceitar.</Callout>
          <div className="flex gap-2">
            <Button asChild variant="primary" className="flex-1">
              <Link href={`/login?proximo=/convite/${token}`}>Entrar</Link>
            </Button>
            <Button asChild variant="secondary" className="flex-1">
              <Link href={`/cadastro?proximo=/convite/${token}`}>Criar conta</Link>
            </Button>
          </div>
        </div>
      ) : (
        <AcceptInviteButton token={token} />
      )}
    </div>
  );
}
