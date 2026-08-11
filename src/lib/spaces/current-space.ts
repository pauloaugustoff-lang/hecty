import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/lib/supabase/types";

const SPACE_COOKIE = "space_id";

export interface SpaceMembership {
  id: string;
  name: string;
  type: "individual" | "compartilhado";
  role: MemberRole;
  isDemo: boolean;
}

export async function listUserSpaces(): Promise<SpaceMembership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("space_members")
    .select("role, spaces(id, name, type, is_demo)")
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data
    .filter((row) => row.spaces)
    .map((row) => {
      const space = row.spaces as unknown as { id: string; name: string; type: "individual" | "compartilhado"; is_demo: boolean };
      return {
        id: space.id,
        name: space.name,
        type: space.type,
        role: row.role,
        isDemo: space.is_demo,
      };
    });
}

/** Resolve o espaço financeiro ativo (via cookie) e garante que o usuário é membro. Redireciona se não houver nenhum. */
export async function requireCurrentSpace(): Promise<SpaceMembership> {
  const spaces = await listUserSpaces();

  if (spaces.length === 0) {
    redirect("/login");
  }

  const cookieStore = await cookies();
  const preferredId = cookieStore.get(SPACE_COOKIE)?.value;

  const preferred = spaces.find((s) => s.id === preferredId);
  return preferred ?? spaces[0];
}

export async function setCurrentSpaceCookie(spaceId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SPACE_COOKIE, spaceId, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
