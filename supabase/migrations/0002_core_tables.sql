-- Perfis de usuário (espelha auth.users) -------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Configurações globais da aplicação (linha única) -----------------------

create table app_settings (
  id smallint primary key default 1 check (id = 1),
  public_signup_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into app_settings (id, public_signup_enabled) values (1, true);

-- Espaços financeiros -----------------------------------------------------

create table spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type space_type not null default 'individual',
  owner_id uuid not null references auth.users (id) on delete cascade,
  is_demo boolean not null default false,
  base_currency char(3) not null default 'BRL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index spaces_owner_id_idx on spaces (owner_id);

-- Membros de um espaço financeiro -----------------------------------------

create table space_members (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role member_role not null default 'visualizador',
  invited_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  unique (space_id, user_id)
);

create index space_members_user_id_idx on space_members (user_id);
create index space_members_space_id_idx on space_members (space_id);

-- Convites para espaços compartilhados -------------------------------------

create table space_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  email text not null,
  role member_role not null default 'editor',
  status invite_status not null default 'pendente',
  token uuid not null default gen_random_uuid(),
  invited_by uuid not null references auth.users (id),
  accepted_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  unique (space_id, email, status)
);

create index space_invites_email_idx on space_invites (lower(email));
