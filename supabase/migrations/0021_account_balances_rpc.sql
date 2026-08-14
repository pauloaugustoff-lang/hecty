-- getAccountBalances() buscava TODAS as transações da conta pro JS somar,
-- sem paginação — em espaços com centenas/milhares de lançamentos isso
-- ultrapassa o limite padrão de linhas do PostgREST (max-rows), truncando
-- a lista silenciosamente e fazendo o saldo parecer "travado" (não reflete
-- lançamentos que ficaram de fora do corte). Move a soma pro banco via
-- função SQL, que agrega antes de devolver — uma linha por conta, sem
-- limite de linhas de transação envolvido.

create or replace function get_account_balances(p_space_id uuid)
returns table (account_id uuid, balance_cents bigint)
language sql
stable
as $$
  select
    a.id as account_id,
    a.initial_balance_cents + coalesce(sum(
      case when t.direction = 'saida' then -t.amount_cents else t.amount_cents end
    ), 0) as balance_cents
  from accounts a
  left join transactions t
    on t.account_id = a.id
    and t.deleted_at is null
  where a.space_id = p_space_id
  group by a.id, a.initial_balance_cents;
$$;

grant execute on function get_account_balances(uuid) to authenticated;
