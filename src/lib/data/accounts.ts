import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type AccountRow = Database["public"]["Tables"]["accounts"]["Row"];

export async function listAccounts(spaceId: string, options?: { includeArchived?: boolean }): Promise<AccountRow[]> {
  const supabase = await createClient();
  let query = supabase.from("accounts").select("*").eq("space_id", spaceId).order("name");

  if (!options?.includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getAccount(id: string): Promise<AccountRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("accounts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Saldo atual = saldo inicial + soma assinada de todas as movimentações não
 * excluídas. Soma feita em SQL (get_account_balances) em vez de trazer toda
 * transação pro JS — contas com centenas/milhares de lançamentos passavam
 * do limite padrão de linhas do PostgREST, truncando a soma silenciosamente.
 */
export async function getAccountBalances(spaceId: string): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_account_balances", { p_space_id: spaceId });
  if (error) throw error;

  const balances: Record<string, number> = {};
  for (const row of data ?? []) {
    balances[row.account_id] = row.balance_cents;
  }
  return balances;
}
