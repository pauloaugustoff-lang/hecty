-- Aceite de convite: só o dono do e-mail convidado pode aceitar, o token
-- precisa ser válido e não pode já ter sido usado.

begin;
select plan(5);

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('f0000000-0000-0000-0000-000000000001', 'inviter@example.com', crypt('senha-teste-123', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('f0000000-0000-0000-0000-000000000002', 'invited@example.com', crypt('senha-teste-123', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated'),
  ('f0000000-0000-0000-0000-000000000003', 'someone-else@example.com', crypt('senha-teste-123', gen_salt('bf')), now(), '{}', '{}', 'authenticated', 'authenticated');

insert into space_invites (space_id, email, role, invited_by, token)
select id, 'invited@example.com', 'editor', 'f0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111'
from spaces where owner_id = 'f0000000-0000-0000-0000-000000000001';

-- Alguém que não é o convidado tenta aceitar: deve falhar.
select set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000003', 'email', 'someone-else@example.com')::text, true);
set local role authenticated;

select throws_ok(
  $$ select accept_space_invite('11111111-1111-1111-1111-111111111111') $$,
  'um usuário com e-mail diferente do convidado não consegue aceitar o convite'
);

reset role;
select ok(
  (select count(*) from space_members m
     join spaces s on s.id = m.space_id
     where s.owner_id = 'f0000000-0000-0000-0000-000000000001'
       and m.user_id = 'f0000000-0000-0000-0000-000000000003') = 0,
  'o impostor não foi adicionado como membro'
);

-- O convidado de verdade aceita: deve funcionar.
select set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000002', 'email', 'invited@example.com')::text, true);
set local role authenticated;

select lives_ok(
  $$ select accept_space_invite('11111111-1111-1111-1111-111111111111') $$,
  'o convidado correto consegue aceitar o convite'
);

reset role;
select ok(
  (select count(*) from space_members m
     join spaces s on s.id = m.space_id
     where s.owner_id = 'f0000000-0000-0000-0000-000000000001'
       and m.user_id = 'f0000000-0000-0000-0000-000000000002'
       and m.role = 'editor') = 1,
  'o convidado foi adicionado como membro com o papel do convite'
);

-- Tentar aceitar de novo (convite já consumido): deve falhar.
select set_config('request.jwt.claims', json_build_object('sub', 'f0000000-0000-0000-0000-000000000002', 'email', 'invited@example.com')::text, true);
set local role authenticated;

select throws_ok(
  $$ select accept_space_invite('11111111-1111-1111-1111-111111111111') $$,
  'um convite já aceito não pode ser aceito novamente'
);

select * from finish();
rollback;
