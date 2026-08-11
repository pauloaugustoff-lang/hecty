-- No primeiro cadastro, o usuário deve ganhar automaticamente: perfil,
-- um espaço financeiro pessoal, titularidade (proprietário) e a
-- taxonomia padrão de categorias.

begin;
select plan(5);

insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values ('e0000000-0000-0000-0000-000000000001', 'novo-usuario@example.com', crypt('senha-teste-123', gen_salt('bf')), now(), '{}', jsonb_build_object('full_name', 'Usuário de Teste'), 'authenticated', 'authenticated');

select ok(
  (select count(*) from profiles where id = 'e0000000-0000-0000-0000-000000000001') = 1,
  'um perfil foi criado automaticamente'
);

select is(
  (select full_name from profiles where id = 'e0000000-0000-0000-0000-000000000001'),
  'Usuário de Teste',
  'o nome do perfil vem de raw_user_meta_data.full_name'
);

select ok(
  (select count(*) from spaces where owner_id = 'e0000000-0000-0000-0000-000000000001' and type = 'individual') = 1,
  'exatamente um espaço pessoal individual foi criado'
);

select ok(
  (select count(*) from space_members m
     join spaces s on s.id = m.space_id
     where s.owner_id = 'e0000000-0000-0000-0000-000000000001'
       and m.user_id = 'e0000000-0000-0000-0000-000000000001'
       and m.role = 'proprietario') = 1,
  'o usuário é membro do próprio espaço com papel de proprietário'
);

select ok(
  (select count(*) from categories c
     join spaces s on s.id = c.space_id
     where s.owner_id = 'e0000000-0000-0000-0000-000000000001') > 20,
  'a taxonomia padrão de categorias foi semeada no novo espaço'
);

select * from finish();
rollback;
