-- Um reembolso (ou estorno) pode cobrir mais de uma despesa com uma única
-- transferência — ex.: paguei dois boletos de R$100 que não eram meus, e a
-- pessoa me devolve tudo numa transferência só de R$200. O antigo
-- transactions.linked_transaction_id só suportava 1:1 (também usado para
-- parear pernas de transferência entre contas, que continuam 1:1 e seguem
-- usando essa coluna). Esta tabela é o vínculo N:N entre a transação de
-- reembolso/estorno e as despesas que ela cobre.

create table transaction_reimbursement_links (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  reimbursement_transaction_id uuid not null references transactions (id) on delete cascade,
  expense_transaction_id uuid not null references transactions (id) on delete cascade,
  allocated_amount_cents bigint not null check (allocated_amount_cents > 0),
  created_at timestamptz not null default now(),
  unique (reimbursement_transaction_id, expense_transaction_id)
);

create index transaction_reimbursement_links_reimb_idx on transaction_reimbursement_links (reimbursement_transaction_id);
create index transaction_reimbursement_links_expense_idx on transaction_reimbursement_links (expense_transaction_id);

alter table transaction_reimbursement_links enable row level security;

create policy transaction_reimbursement_links_select on transaction_reimbursement_links
  for select using (is_space_member(space_id));
create policy transaction_reimbursement_links_insert on transaction_reimbursement_links
  for insert with check (can_edit_space(space_id));
create policy transaction_reimbursement_links_update on transaction_reimbursement_links
  for update using (can_edit_space(space_id)) with check (can_edit_space(space_id));
create policy transaction_reimbursement_links_delete on transaction_reimbursement_links
  for delete using (can_edit_space(space_id));

-- Migra vínculos 1:1 já existentes (criados antes desta tabela existir) para
-- o novo modelo, e limpa a coluna antiga para essas naturezas.
insert into transaction_reimbursement_links (space_id, reimbursement_transaction_id, expense_transaction_id, allocated_amount_cents)
select space_id, id, linked_transaction_id, amount_cents
from transactions
where nature in ('reembolso', 'estorno') and linked_transaction_id is not null
on conflict do nothing;

update transactions set linked_transaction_id = null
where nature in ('reembolso', 'estorno') and linked_transaction_id is not null;
