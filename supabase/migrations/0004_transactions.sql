-- Lotes de importação (declarados antes de transactions para permitir FK) --

create table import_batches (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  source_type import_source_type not null,
  file_name text not null,
  account_id uuid references accounts (id) on delete set null,
  card_id uuid references cards (id) on delete set null,
  status import_status not null default 'pendente',
  column_mapping jsonb not null default '{}'::jsonb,
  total_rows integer not null default 0,
  imported_rows integer not null default 0,
  duplicate_rows integer not null default 0,
  ignored_rows integer not null default 0,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by uuid references auth.users (id),
  check (
    (account_id is not null and card_id is null) or
    (account_id is null and card_id is not null)
  )
);

create index import_batches_space_id_idx on import_batches (space_id);

-- Transações ------------------------------------------------------------

create table transactions (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,

  account_id uuid references accounts (id) on delete cascade,
  card_id uuid references cards (id) on delete cascade,

  movement_date date not null,
  competence_date date not null,

  original_description text not null default '',
  normalized_description text not null default '',

  amount_cents bigint not null check (amount_cents > 0),
  direction transaction_direction not null,

  nature transaction_nature not null default 'nao_classificado',
  category_id uuid references categories (id) on delete set null,
  subcategory_id uuid references categories (id) on delete set null,

  counterparty text not null default '',
  notes text not null default '',

  origin transaction_origin not null default 'manual',
  classification_status classification_status not null default 'nao_classificado',

  installment_number smallint,
  installment_total smallint,
  installment_group_id uuid,

  tags text[] not null default '{}',

  linked_transaction_id uuid references transactions (id) on delete set null,
  paid_card_id uuid references cards (id) on delete set null,

  import_batch_id uuid references import_batches (id) on delete set null,
  import_external_id text,
  dedup_hash text not null,
  is_reconciled boolean not null default false,

  classified_by_rule_id uuid,

  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (
    (account_id is not null and card_id is null) or
    (account_id is null and card_id is not null)
  ),
  check (
    subcategory_id is null or category_id is not null
  )
);

create index transactions_space_id_idx on transactions (space_id);
create index transactions_account_id_idx on transactions (account_id);
create index transactions_card_id_idx on transactions (card_id);
create index transactions_movement_date_idx on transactions (movement_date);
create index transactions_dedup_hash_idx on transactions (space_id, dedup_hash);
create index transactions_import_batch_id_idx on transactions (import_batch_id);
create index transactions_classification_status_idx on transactions (space_id, classification_status);
create index transactions_nature_idx on transactions (space_id, nature);
create index transactions_not_deleted_idx on transactions (space_id) where deleted_at is null;

-- Subcategoria deve pertencer à mesma categoria-mãe informada.
create or replace function check_transaction_category()
returns trigger
language plpgsql
as $$
declare
  sub_parent_id uuid;
begin
  if new.subcategory_id is not null then
    select parent_id into sub_parent_id from categories where id = new.subcategory_id;
    if sub_parent_id is distinct from new.category_id then
      raise exception 'subcategoria não pertence à categoria informada';
    end if;
  end if;
  return new;
end;
$$;

create trigger transactions_category_check
  before insert or update on transactions
  for each row execute function check_transaction_category();

-- Decomposição de resgates de investimento -------------------------------
-- Cada resgate pode conter devolução de principal, rendimento bruto,
-- imposto, taxas e rendimento líquido. Quando o extrato traz apenas o
-- valor total, o lançamento nasce como "resgate a decompor" e este
-- registro fica com os campos detalhados em branco até a decomposição.

create table redemption_details (
  transaction_id uuid primary key references transactions (id) on delete cascade,
  space_id uuid not null references spaces (id) on delete cascade,
  total_amount_cents bigint not null,
  principal_cents bigint,
  gross_yield_cents bigint,
  tax_cents bigint,
  fees_cents bigint,
  net_yield_cents bigint,
  institution text not null default '',
  product text not null default '',
  application_date date,
  redemption_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index redemption_details_space_id_idx on redemption_details (space_id);
