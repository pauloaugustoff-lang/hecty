"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteFormSchema, spaceFormSchema } from "@/lib/validation/schemas";
import type { MemberRole } from "@/lib/supabase/types";
import { seedDemoData } from "@/lib/demo/seed";

export interface ActionState {
  error?: string;
  success?: boolean;
}

export async function renameSpaceAction(spaceId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = spaceFormSchema.pick({ name: true }).safeParse({ name: formData.get("name") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Nome inválido." };

  const supabase = await createClient();
  const { error } = await supabase.from("spaces").update({ name: parsed.data.name }).eq("id", spaceId);
  if (error) return { error: "Não foi possível renomear o espaço." };

  revalidatePath("/", "layout");
  return { success: true };
}

export async function createSpaceAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = spaceFormSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") ?? "compartilhado",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase.from("spaces").insert({ name: parsed.data.name, type: parsed.data.type, owner_id: user.id });
  if (error) return { error: "Não foi possível criar o espaço." };

  revalidatePath("/", "layout");
  return { success: true };
}

export async function inviteMemberAction(spaceId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = inviteFormSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase.from("space_invites").insert({
    space_id: spaceId,
    email: parsed.data.email.toLowerCase(),
    role: parsed.data.role,
    invited_by: user.id,
  });

  if (error) {
    return { error: error.message.includes("duplicate") ? "Já existe um convite pendente para este e-mail." : "Não foi possível enviar o convite." };
  }

  revalidatePath("/configuracoes/membros");
  return { success: true };
}

export async function revokeInviteAction(inviteId: string) {
  const supabase = await createClient();
  await supabase.from("space_invites").update({ status: "revogado" }).eq("id", inviteId);
  revalidatePath("/configuracoes/membros");
}

export async function removeMemberAction(memberId: string) {
  const supabase = await createClient();
  await supabase.from("space_members").delete().eq("id", memberId);
  revalidatePath("/configuracoes/membros");
}

export async function changeMemberRoleAction(memberId: string, role: MemberRole) {
  const supabase = await createClient();
  await supabase.from("space_members").update({ role }).eq("id", memberId);
  revalidatePath("/configuracoes/membros");
}

export async function togglePublicSignupAction(enabled: boolean): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { data: isOwnerSomewhere } = await supabase
    .from("space_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "proprietario")
    .limit(1)
    .maybeSingle();

  if (!isOwnerSomewhere) {
    return { error: "Apenas proprietários de um espaço podem alterar esta configuração." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("app_settings").update({ public_signup_enabled: enabled }).eq("id", 1);
  if (error) return { error: "Não foi possível salvar." };

  revalidatePath("/configuracoes");
  return { success: true };
}

export async function loadDemoDataAction(): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  try {
    await seedDemoData(supabase, user.id);
  } catch {
    return { error: "Não foi possível gerar os dados de demonstração." };
  }

  revalidatePath("/", "layout");
  return { success: true };
}
