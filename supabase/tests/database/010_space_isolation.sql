-- Isolamento entre espaços financeiros: um usuário nunca deve enxergar
-- nem conseguir escrever em dados de um espaço do qual não é membro.

begin;
select plan(9);

-- Fixtures: dois usuários, cada um ganha um espaço pessoal automaticamente
-- via o gatilho handle_new_user / handle_new_space.
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('a0000000-0000-0000-0000-000000000001', 'user-a@example.com', crypt('senha-teste-123', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000002', 'user-b@example.com', crypt('senha-teste-123', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated');

select ok(
  (select count(*) from spaces where owner_id = 'a0000000-0000-0000-0000-000000000001') = 1,
  'usuário A ganhou exatamente um espaço pessoal automaticamente'
);

select ok(
  (select count(*) from spaces where owner_id = 'a0000000-0000-0000-0000-000000000002') = 1,
  'usuário B ganhou exatamente um espaço pessoal automaticamente'
);

-- Uma conta em cada espaço, criada como superusuário (bypassa RLS de propósito
-- só para preparar a fixture).
insert into accounts (space_id, name, type)
select id, 'Conta do usuário A', 'corrente' from spaces where owner_id = 'a0000000-0000-0000-0000-000000000001';

insert into accounts (space_id, name, type)
select id, 'Conta do usuário B', 'corrente' from spaces where owner_id = 'a0000000-0000-0000-0000-000000000002';

-- A partir daqui, assume a identidade do usuário A via RLS de verdade.
select set_config('request.jwt.claims', json_build_object('sub', 'a0000000-0000-0000-0000-000000000001')::text, true);
set local role authenticated;

select ok(
  (select count(*) from spaces where owner_id = 'a0000000-0000-0000-0000-000000000001') = 1,
  'usuário A enxerga o próprio espaço'
);

select ok(
  (select count(*) from spaces where owner_id = 'a0000000-0000-0000-0000-000000000002') = 0,
  'usuário A NÃO enxerga o espaço do usuário B'
);

select ok(
  (select count(*) from accounts where name = 'Conta do usuário A') = 1,
  'usuário A enxerga a própria conta'
);

select ok(
  (select count(*) from accounts where name = 'Conta do usuário B') = 0,
  'usuário A NÃO enxerga a conta do usuário B'
);

select throws_ok(
  $$ insert into accounts (space_id, name, type)
     select id, 'Conta invasora', 'corrente' from spaces where owner_id = 'a0000000-0000-0000-0000-000000000002' $$,
  'usuário A NÃO consegue inserir uma conta no espaço do usuário B (violação de RLS)'
);

-- A linha do usuário B é invisível para A sob RLS, então o UPDATE não
-- lança erro: apenas não encontra (nem afeta) nenhuma linha.
select lives_ok(
  $$ update accounts set name = 'Hackeado' where name = 'Conta do usuário B' $$,
  'a tentativa de update na conta do usuário B não lança erro (a linha é apenas invisível)'
);

-- Confirma que a tentativa de update acima realmente não alterou nada,
-- checando de volta como superusuário.
reset role;
select ok(
  (select name from accounts where name = 'Conta do usuário B') = 'Conta do usuário B',
  'a conta do usuário B permanece intacta após a tentativa de invasão'
);

select * from finish();
rollback;
