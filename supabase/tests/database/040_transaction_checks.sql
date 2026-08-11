-- Integridade de transações: exatamente conta OU cartão (nunca os dois,
-- nunca nenhum), e subcategoria deve pertencer à categoria informada.

begin;
select plan(5);

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values ('d0000000-0000-0000-0000-000000000001', 'tx-checks@example.com', crypt('senha-teste-123', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated');

insert into accounts (space_id, name, type)
select id, 'Conta de teste', 'corrente' from spaces where owner_id = 'd0000000-0000-0000-0000-000000000001';

insert into categories (space_id, kind, name)
select id, 'despesa', 'Categoria de teste' from spaces where owner_id = 'd0000000-0000-0000-0000-000000000001';

insert into categories (space_id, parent_id, kind, name)
select s.id, c.id, 'despesa', 'Subcategoria de teste'
from spaces s join categories c on c.space_id = s.id and c.name = 'Categoria de teste'
where s.owner_id = 'd0000000-0000-0000-0000-000000000001';

insert into categories (space_id, kind, name)
select id, 'despesa', 'Outra categoria (não é mãe)' from spaces where owner_id = 'd0000000-0000-0000-0000-000000000001';

-- Sem conta e sem cartão: viola o CHECK constraint.
select throws_ok(
  $$ insert into transactions (space_id, movement_date, competence_date, amount_cents, direction, dedup_hash)
     select id, current_date, current_date, 1000, 'saida', 'hash-sem-origem' from spaces where owner_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'transação sem conta e sem cartão é rejeitada'
);

-- Conta E cartão ao mesmo tempo: viola o CHECK constraint.
select throws_ok(
  $$ insert into transactions (space_id, account_id, card_id, movement_date, competence_date, amount_cents, direction, dedup_hash)
     select s.id, a.id, '00000000-0000-0000-0000-000000000000', current_date, current_date, 1000, 'saida', 'hash-dupla-origem'
     from spaces s join accounts a on a.space_id = s.id and a.name = 'Conta de teste'
     where s.owner_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'transação com conta e cartão simultaneamente é rejeitada'
);

-- Valor zero ou negativo: viola o CHECK constraint de amount_cents > 0.
select throws_ok(
  $$ insert into transactions (space_id, account_id, movement_date, competence_date, amount_cents, direction, dedup_hash)
     select s.id, a.id, current_date, current_date, 0, 'saida', 'hash-valor-zero'
     from spaces s join accounts a on a.space_id = s.id and a.name = 'Conta de teste'
     where s.owner_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'transação com valor zero é rejeitada'
);

-- Subcategoria que não pertence à categoria informada: rejeitada pelo gatilho.
select throws_ok(
  $$ insert into transactions (space_id, account_id, movement_date, competence_date, amount_cents, direction, category_id, subcategory_id, dedup_hash)
     select s.id, a.id, current_date, current_date, 1000, 'saida', c2.id, sub.id, 'hash-subcategoria-errada'
     from spaces s
     join accounts a on a.space_id = s.id and a.name = 'Conta de teste'
     join categories c2 on c2.space_id = s.id and c2.name = 'Outra categoria (não é mãe)'
     join categories sub on sub.space_id = s.id and sub.name = 'Subcategoria de teste'
     where s.owner_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'transação com subcategoria que não pertence à categoria informada é rejeitada'
);

-- Combinação correta: sucede.
select lives_ok(
  $$ insert into transactions (space_id, account_id, movement_date, competence_date, amount_cents, direction, category_id, subcategory_id, dedup_hash)
     select s.id, a.id, current_date, current_date, 1000, 'saida', c.id, sub.id, 'hash-valida'
     from spaces s
     join accounts a on a.space_id = s.id and a.name = 'Conta de teste'
     join categories c on c.space_id = s.id and c.name = 'Categoria de teste'
     join categories sub on sub.space_id = s.id and sub.name = 'Subcategoria de teste'
     where s.owner_id = 'd0000000-0000-0000-0000-000000000001' $$,
  'transação com conta, categoria e subcategoria coerentes é aceita'
);

select * from finish();
rollback;
