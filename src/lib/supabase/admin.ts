import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

/**
 * Cliente com a service role key — ignora RLS completamente. Nunca deve
 * ser importado por código que possa acabar em um bundle de cliente
 * (o `server-only` acima garante isso em tempo de build). Use apenas
 * para operações administrativas explícitas (ex.: alternar o cadastro
 * público em app_settings), nunca para servir dados de um espaço
 * financeiro específico.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }

  return createSupabaseClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
