-- Habilita RLS em todas as tabelas privadas e define as políticas de
-- isolamento por espaço financeiro. Nenhuma tabela financeira é acessível
-- sem passar por is_space_member / can_edit_space / can_admin_space.

alter table profiles enable row level security;
alter table app_settings enable row level security;
alter table spaces enable row level security;
alter table space_members enable row level security;
alter table space_invites enable row level security;
alter table categories enable row level security;
alter table accounts enable row level security;
alter table cards enable row level security;
alter table transactions enable row level security;
alter table redemption_details enable row level security;
alter table import_batches enable row level security;
alter table import_batch_rows enable row level security;
alter table rules enable row level security;
alter table budgets enable row level security;
alter table audit_log enable row level security;

-- profiles ------------------------------------------------------------
create policy profiles_select on profiles for select
  using (
    id = auth.uid()
    or id in (
      select m2.user_id from space_members m1
      join space_members m2 on m2.space_id = m1.space_id
      where m1.user_id = auth.uid()
    )
  );

create policy profiles_update_self on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- app_settings ----------------------------------------------------------
create policy app_settings_select_all on app_settings for select
  to anon, authenticated
  using (true);

-- spaces ----------------------------------------------------------------
-- owner_id = auth.uid() é checado em paralelo a is_space_member: o
-- gatilho on_space_created cria a associação de proprietário DEPOIS que
-- a linha é inserida, então a cláusula RETURNING do próprio INSERT
-- (avaliada antes do gatilho AFTER INSERT) precisa dessa segunda
-- condição para conseguir devolver o espaço recém-criado a quem o criou.
create policy spaces_select on spaces for select
  using (is_space_member(id) or owner_id = auth.uid());

create policy spaces_insert on spaces for insert
  with check (owner_id = auth.uid());

create policy spaces_update on spaces for update
  using (can_admin_space(id))
  with check (can_admin_space(id));

create policy spaces_delete on spaces for delete
  using (has_space_role(id, array['proprietario']::member_role[]));

-- space_members -----------------------------------------------------------
create policy space_members_select on space_members for select
  using (is_space_member(space_id));

create policy space_members_insert on space_members for insert
  with check (can_admin_space(space_id));

create policy space_members_update on space_members for update
  using (can_admin_space(space_id))
  with check (can_admin_space(space_id));

create policy space_members_delete on space_members for delete
  using (can_admin_space(space_id) or user_id = auth.uid());

-- space_invites -----------------------------------------------------------
create policy space_invites_select on space_invites for select
  using (
    can_admin_space(space_id)
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy space_invites_insert on space_invites for insert
  with check (can_admin_space(space_id));

create policy space_invites_update on space_invites for update
  using (can_admin_space(space_id))
  with check (can_admin_space(space_id));

create policy space_invites_delete on space_invites for delete
  using (can_admin_space(space_id));

-- Tabelas financeiras: mesmo padrão de select/insert/update/delete --------

create policy categories_select on categories for select using (is_space_member(space_id));
create policy categories_insert on categories for insert with check (can_edit_space(space_id));
create policy categories_update on categories for update using (can_edit_space(space_id)) with check (can_edit_space(space_id));
create policy categories_delete on categories for delete using (can_admin_space(space_id));

create policy accounts_select on accounts for select using (is_space_member(space_id));
create policy accounts_insert on accounts for insert with check (can_edit_space(space_id));
create policy accounts_update on accounts for update using (can_edit_space(space_id)) with check (can_edit_space(space_id));
create policy accounts_delete on accounts for delete using (can_admin_space(space_id));

create policy cards_select on cards for select using (is_space_member(space_id));
create policy cards_insert on cards for insert with check (can_edit_space(space_id));
create policy cards_update on cards for update using (can_edit_space(space_id)) with check (can_edit_space(space_id));
create policy cards_delete on cards for delete using (can_admin_space(space_id));

create policy transactions_select on transactions for select using (is_space_member(space_id));
create policy transactions_insert on transactions for insert with check (can_edit_space(space_id));
create policy transactions_update on transactions for update using (can_edit_space(space_id)) with check (can_edit_space(space_id));
create policy transactions_delete on transactions for delete using (can_admin_space(space_id));

create policy redemption_details_select on redemption_details for select using (is_space_member(space_id));
create policy redemption_details_insert on redemption_details for insert with check (can_edit_space(space_id));
create policy redemption_details_update on redemption_details for update using (can_edit_space(space_id)) with check (can_edit_space(space_id));
create policy redemption_details_delete on redemption_details for delete using (can_admin_space(space_id));

create policy import_batches_select on import_batches for select using (is_space_member(space_id));
create policy import_batches_insert on import_batches for insert with check (can_edit_space(space_id));
create policy import_batches_update on import_batches for update using (can_edit_space(space_id)) with check (can_edit_space(space_id));
create policy import_batches_delete on import_batches for delete using (can_admin_space(space_id));

create policy import_batch_rows_select on import_batch_rows for select using (is_space_member(space_id));
create policy import_batch_rows_insert on import_batch_rows for insert with check (can_edit_space(space_id));
create policy import_batch_rows_update on import_batch_rows for update using (can_edit_space(space_id)) with check (can_edit_space(space_id));
create policy import_batch_rows_delete on import_batch_rows for delete using (can_admin_space(space_id));

create policy rules_select on rules for select using (is_space_member(space_id));
create policy rules_insert on rules for insert with check (can_edit_space(space_id));
create policy rules_update on rules for update using (can_edit_space(space_id)) with check (can_edit_space(space_id));
create policy rules_delete on rules for delete using (can_admin_space(space_id));

create policy budgets_select on budgets for select using (is_space_member(space_id));
create policy budgets_insert on budgets for insert with check (can_edit_space(space_id));
create policy budgets_update on budgets for update using (can_edit_space(space_id)) with check (can_edit_space(space_id));
create policy budgets_delete on budgets for delete using (can_admin_space(space_id));

-- audit_log: somente leitura pelos membros; escrita só via trigger interno.
create policy audit_log_select on audit_log for select using (is_space_member(space_id));
