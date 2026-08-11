-- Categorias (árvore de 2 níveis: categoria > subcategoria) --------------

create table categories (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  parent_id uuid references categories (id) on delete cascade,
  kind category_kind not null default 'despesa',
  name text not null,
  color text not null default '#64748b',
  icon text,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_space_id_idx on categories (space_id);
create index categories_parent_id_idx on categories (parent_id);

-- Uma subcategoria deve pertencer ao mesmo espaço que sua categoria-mãe
-- e uma categoria-mãe não pode ela mesma ter um pai (só 2 níveis).
create or replace function check_category_hierarchy()
returns trigger
language plpgsql
as $$
declare
  parent_space_id uuid;
  parent_of_parent uuid;
begin
  if new.parent_id is not null then
    select space_id, parent_id into parent_space_id, parent_of_parent
    from categories where id = new.parent_id;

    if parent_space_id is null then
      raise exception 'categoria pai não encontrada';
    end if;

    if parent_space_id <> new.space_id then
      raise exception 'categoria pai pertence a outro espaço financeiro';
    end if;

    if parent_of_parent is not null then
      raise exception 'apenas dois níveis de categoria são permitidos (categoria > subcategoria)';
    end if;
  end if;

  return new;
end;
$$;

create trigger categories_hierarchy_check
  before insert or update on categories
  for each row execute function check_category_hierarchy();

-- Contas --------------------------------------------------------------

create table accounts (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  name text not null,
  institution text not null default '',
  type account_type not null default 'corrente',
  initial_balance_cents bigint not null default 0,
  initial_balance_date date not null default current_date,
  currency char(3) not null default 'BRL',
  color text not null default '#3b82f6',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index accounts_space_id_idx on accounts (space_id);

-- Cartões ---------------------------------------------------------------

create table cards (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  name text not null,
  institution text not null default '',
  brand card_brand not null default 'outra',
  limit_cents bigint not null default 0,
  closing_day smallint not null check (closing_day between 1 and 31),
  due_day smallint not null check (due_day between 1 and 31),
  payment_account_id uuid references accounts (id) on delete set null,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cards_space_id_idx on cards (space_id);
