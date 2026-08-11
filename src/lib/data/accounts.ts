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

/** Saldo atual = saldo inicial + soma assinada de todas as movimentações não excluídas. */
export async function getAccountBalances(spaceId: string): Promise<Record<string, number>> {
  const supabase = await createClient();

  const [{ data: accounts, error: accountsError }, { data: transactions, error: txError }] = await Promise.all([
    supabase.from("accounts").select("id, initial_balance_cents").eq("space_id", spaceId),
    supabase
      .from("transactions")
      .select("account_id, amount_cents, direction")
      .eq("space_id", spaceId)
      .is("deleted_at", null)
      .not("account_id", "is", null),
  ]);

  if (accountsError) throw accountsError;
  if (txError) throw txError;

  const balances: Record<string, number> = {};
  for (const account of accounts ?? []) {
    balances[account.id] = account.initial_balance_cents;
  }

  for (const tx of transactions ?? []) {
    if (!tx.account_id) continue;
    const signed = tx.direction === "saida" ? -tx.amount_cents : tx.amount_cents;
    balances[tx.account_id] = (balances[tx.account_id] ?? 0) + signed;
  }

  return balances;
}
