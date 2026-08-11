-- No primeiro cadastro: cria o perfil, um espaço financeiro pessoal,
-- a titularidade (proprietário) e a taxonomia padrão de categorias.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
begin
  display_name := coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1));

  insert into profiles (id, full_name)
  values (new.id, display_name);

  -- A inserção abaixo dispara on_space_created, que cria a titularidade
  -- (proprietário) e semeia a taxonomia padrão de categorias.
  insert into spaces (name, type, owner_id)
  values (display_name || ' — Pessoal', 'individual', new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Toda criação de espaço financeiro (o pessoal do primeiro cadastro, ou
-- um adicional criado depois, ex.: compartilhado com o cônjuge) sempre
-- torna quem cria o proprietário e semeia a taxonomia padrão.

create or replace function handle_new_space()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into space_members (space_id, user_id, role)
  values (new.id, new.owner_id, 'proprietario')
  on conflict (space_id, user_id) do nothing;

  perform seed_default_categories(new.id);

  return new;
end;
$$;

create trigger on_space_created
  after insert on spaces
  for each row execute function handle_new_space();
