import { createClient } from "@/lib/supabase/server";

export interface SpaceMemberWithProfile {
  id: string;
  userId: string;
  role: string;
  fullName: string;
  createdAt: string;
}

export async function listSpaceMembers(spaceId: string): Promise<SpaceMemberWithProfile[]> {
  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from("space_members")
    .select("id, user_id, role, created_at")
    .eq("space_id", spaceId)
    .order("created_at");

  if (error) throw error;
  if (!members || members.length === 0) return [];

  // Não há FK direta entre space_members e profiles (ambas referenciam
  // auth.users separadamente), então o PostgREST não consegue montar esse
  // embed automaticamente — buscamos os perfis à parte e unimos aqui.
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", members.map((m) => m.user_id));

  if (profilesError) throw profilesError;

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  return members.map((row) => ({
    id: row.id,
    userId: row.user_id,
    role: row.role,
    fullName: nameById.get(row.user_id) ?? "—",
    createdAt: row.created_at,
  }));
}

export interface SpaceInviteRow {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export async function listSpaceInvites(spaceId: string): Promise<SpaceInviteRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("space_invites")
    .select("id, email, role, status, created_at")
    .eq("space_id", spaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  }));
}
