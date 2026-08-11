-- Funções auxiliares para as políticas de RLS -----------------------------
-- SECURITY DEFINER + search_path fixo evitam recursão de RLS ao consultar
-- space_members a partir de políticas de outras tabelas, e evitam
-- "search path hijacking".

create or replace function is_space_member(p_space_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from space_members m
    where m.space_id = p_space_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function space_role(p_space_id uuid)
returns member_role
language sql
security definer
stable
set search_path = public
as $$
  select m.role from space_members m
  where m.space_id = p_space_id and m.user_id = auth.uid()
  limit 1;
$$;

create or replace function has_space_role(p_space_id uuid, p_roles member_role[])
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from space_members m
    where m.space_id = p_space_id
      and m.user_id = auth.uid()
      and m.role = any(p_roles)
  );
$$;

-- Papéis que podem editar dados financeiros (criar/editar lançamentos etc.)
create or replace function can_edit_space(p_space_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select has_space_role(p_space_id, array['proprietario','administrador','editor']::member_role[]);
$$;

-- Papéis que podem administrar o espaço (membros, exclusões definitivas)
create or replace function can_admin_space(p_space_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select has_space_role(p_space_id, array['proprietario','administrador']::member_role[]);
$$;
