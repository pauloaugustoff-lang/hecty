-- Linhas de um lote de importação, usadas no assistente antes da
-- confirmação (permite revisar duplicidades sem perder o progresso). ------

create table import_batch_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references import_batches (id) on delete cascade,
  space_id uuid not null references spaces (id) on delete cascade,
  row_index integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  movement_date date,
  competence_date date,
  original_description text not null default '',
  normalized_description text not null default '',
  amount_cents bigint,
  direction transaction_direction,
  external_id text,
  dedup_hash text,
  potential_duplicate_of uuid references transactions (id) on delete set null,
  status import_row_status not null default 'pendente',
  suggested_nature transaction_nature,
  suggested_category_id uuid references categories (id) on delete set null,
  suggested_subcategory_id uuid references categories (id) on delete set null,
  suggested_by_rule_id uuid,
  resulting_transaction_id uuid references transactions (id) on delete set null,
  created_at timestamptz not null default now()
);

create index import_batch_rows_batch_id_idx on import_batch_rows (batch_id);
create index import_batch_rows_space_id_idx on import_batch_rows (space_id);

-- Regras automáticas de classificação -------------------------------------

create table rules (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  priority integer not null default 100,

  match_type rule_match_type not null default 'contem',
  match_value text not null,

  source_account_id uuid references accounts (id) on delete cascade,
  source_card_id uuid references cards (id) on delete cascade,
  min_amount_cents bigint,
  max_amount_cents bigint,
  direction transaction_direction,

  action_nature transaction_nature,
  action_category_id uuid references categories (id) on delete set null,
  action_subcategory_id uuid references categories (id) on delete set null,
  action_counterparty text,
  action_tags text[],
  action_notes text,
  action_mark_transfer boolean not null default false,
  action_mark_redemption boolean not null default false,

  times_applied integer not null default 0,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rules_space_id_idx on rules (space_id, priority);

alter table transactions
  add constraint transactions_classified_by_rule_id_fkey
  foreign key (classified_by_rule_id) references rules (id) on delete set null;

alter table import_batch_rows
  add constraint import_batch_rows_suggested_by_rule_id_fkey
  foreign key (suggested_by_rule_id) references rules (id) on delete set null;
