-- Orçamentos (Planejamento) -------------------------------------------
-- Um valor-alvo por categoria e mês de competência.

create table budgets (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  reference_month date not null, -- sempre dia 1 do mês
  planned_amount_cents bigint not null check (planned_amount_cents >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (space_id, category_id, reference_month)
);

create index budgets_space_id_idx on budgets (space_id, reference_month);

-- Trilha de auditoria -----------------------------------------------------

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

create index audit_log_space_id_idx on audit_log (space_id, created_at desc);
create index audit_log_entity_idx on audit_log (entity_type, entity_id);

create or replace function record_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    insert into audit_log (space_id, user_id, entity_type, entity_id, action, before)
    values (old.space_id, auth.uid(), tg_table_name, old.id, 'delete', to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    insert into audit_log (space_id, user_id, entity_type, entity_id, action, before, after)
    values (new.space_id, auth.uid(), tg_table_name, new.id, 'update', to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into audit_log (space_id, user_id, entity_type, entity_id, action, after)
    values (new.space_id, auth.uid(), tg_table_name, new.id, 'insert', to_jsonb(new));
    return new;
  end if;
end;
$$;

create trigger transactions_audit
  after insert or update or delete on transactions
  for each row execute function record_audit_event();

create trigger accounts_audit
  after insert or update or delete on accounts
  for each row execute function record_audit_event();

create trigger cards_audit
  after insert or update or delete on cards
  for each row execute function record_audit_event();

-- updated_at automático -----------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on profiles for each row execute function set_updated_at();
create trigger spaces_set_updated_at before update on spaces for each row execute function set_updated_at();
create trigger categories_set_updated_at before update on categories for each row execute function set_updated_at();
create trigger accounts_set_updated_at before update on accounts for each row execute function set_updated_at();
create trigger cards_set_updated_at before update on cards for each row execute function set_updated_at();
create trigger transactions_set_updated_at before update on transactions for each row execute function set_updated_at();
create trigger redemption_details_set_updated_at before update on redemption_details for each row execute function set_updated_at();
create trigger rules_set_updated_at before update on rules for each row execute function set_updated_at();
create trigger budgets_set_updated_at before update on budgets for each row execute function set_updated_at();
