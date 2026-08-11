-- Permissões por papel: visualizador só lê; editor cria/edita mas não
-- apaga; administrador/proprietário podem apagar.

begin;
select plan(7);

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('b0000000-0000-0000-0000-000000000001', 'owner@example.com', crypt('senha-teste-123', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-000000000002', 'viewer@example.com', crypt('senha-teste-123', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-000000000003', 'editor@example.com', crypt('senha-teste-123', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated');

-- Espaço pessoal do proprietário (criado automaticamente pelo gatilho),
-- com um visualizador e um editor adicionados diretamente (como
-- superusuário, só para montar a fixture).
insert into space_members (space_id, user_id, role)
select id, 'b0000000-0000-0000-0000-000000000002', 'visualizador' from spaces where owner_id = 'b0000000-0000-0000-0000-000000000001';

insert into space_members (space_id, user_id, role)
select id, 'b0000000-0000-0000-0000-000000000003', 'editor' from spaces where owner_id = 'b0000000-0000-0000-0000-000000000001';

insert into accounts (space_id, name, type)
select id, 'Conta compartilhada', 'corrente' from spaces where owner_id = 'b0000000-0000-0000-0000-000000000001';

-- Como visualizador ---------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'b0000000-0000-0000-0000-000000000002')::text, true);
set local role authenticated;

select ok(
  (select count(*) from accounts where name = 'Conta compartilhada') = 1,
  'visualizador consegue ler contas do espaço compartilhado'
);

select throws_ok(
  $$ insert into accounts (space_id, name, type)
     select id, 'Conta criada por visualizador', 'corrente' from spaces where owner_id = 'b0000000-0000-0000-0000-000000000001' $$,
  'visualizador NÃO consegue criar uma conta'
);

reset role;

-- Como editor -----------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'b0000000-0000-0000-0000-000000000003')::text, true);
set local role authenticated;

select lives_ok(
  $$ insert into accounts (space_id, name, type)
     select id, 'Conta criada por editor', 'corrente' from spaces where owner_id = 'b0000000-0000-0000-0000-000000000001' $$,
  'editor consegue criar uma conta'
);

select lives_ok(
  $$ update accounts set name = 'Conta compartilhada (renomeada pelo editor)' where name = 'Conta compartilhada' $$,
  'editor consegue editar uma conta existente'
);

select throws_ok(
  $$ delete from accounts where name like 'Conta criada por editor%' $$,
  'editor NÃO consegue excluir uma conta (exclusão é restrita a administrador/proprietário)'
);

reset role;

-- Confirma que a conta criada pelo editor sobreviveu à tentativa de exclusão.
select ok(
  (select count(*) from accounts where name like 'Conta criada por editor%') = 1,
  'a conta criada pelo editor não foi removida pela tentativa de exclusão negada'
);

-- Como proprietário -------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'b0000000-0000-0000-0000-000000000001')::text, true);
set local role authenticated;

select lives_ok(
  $$ delete from accounts where name like 'Conta criada por editor%' $$,
  'proprietário consegue excluir contas do espaço'
);

select * from finish();
rollback;
