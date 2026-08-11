-- Hierarquia de categorias: só duas camadas (categoria > subcategoria),
-- e uma subcategoria não pode citar uma categoria-mãe de outro espaço.

begin;
select plan(4);

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('c0000000-0000-0000-0000-000000000001', 'cat-a@example.com', crypt('senha-teste-123', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-000000000002', 'cat-b@example.com', crypt('senha-teste-123', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated');

insert into categories (space_id, kind, name)
select id, 'despesa', 'Categoria raiz de teste' from spaces where owner_id = 'c0000000-0000-0000-0000-000000000001';

select lives_ok(
  $$ insert into categories (space_id, parent_id, kind, name)
     select s.id, c.id, 'despesa', 'Subcategoria válida'
     from spaces s
     join categories c on c.space_id = s.id and c.name = 'Categoria raiz de teste'
     where s.owner_id = 'c0000000-0000-0000-0000-000000000001' $$,
  'criar uma subcategoria de primeiro nível é permitido'
);

select throws_ok(
  $$ insert into categories (space_id, parent_id, kind, name)
     select s.id, c.id, 'despesa', 'Sub-subcategoria inválida'
     from spaces s
     join categories c on c.space_id = s.id and c.name = 'Subcategoria válida'
     where s.owner_id = 'c0000000-0000-0000-0000-000000000001' $$,
  'criar uma subcategoria de uma subcategoria (3º nível) é rejeitado'
);

select throws_ok(
  $$ insert into categories (space_id, parent_id, kind, name)
     select s.id, c.id, 'despesa', 'Subcategoria de outro espaço'
     from spaces s
     join categories c on c.name = 'Categoria raiz de teste'
     where s.owner_id = 'c0000000-0000-0000-0000-000000000002' $$,
  'uma subcategoria não pode referenciar uma categoria-mãe de outro espaço'
);

select is(
  (select count(*) from categories where name = 'Subcategoria de outro espaço'),
  0::bigint,
  'a subcategoria cross-espaço rejeitada não foi persistida'
);

select * from finish();
rollback;
