-- Tags: marcação transversal a categorias (ex.: "Viagem Tiradentes" cobrindo
-- hospedagem, restaurante, compras...), pra somar o total de um evento sem
-- misturar com a árvore de categoria/subcategoria. A coluna
-- transactions.tags (text[]) já existia sem uso; esta tabela só passa a
-- dar nome canônico + cor a cada tag, evitando duplicidade por digitação
-- ("Tiradentes" vs "tiradentes") — o vínculo em si continua no array.

create table tags (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces (id) on delete cascade,
  name text not null,
  color text not null default '#8b5cf6',
  created_at timestamptz not null default now()
);

create index tags_space_id_idx on tags (space_id);

alter table tags enable row level security;

create policy tags_select on tags for select using (is_space_member(space_id));
create policy tags_insert on tags for insert with check (can_edit_space(space_id));
create policy tags_update on tags for update using (can_edit_space(space_id)) with check (can_edit_space(space_id));
create policy tags_delete on tags for delete using (can_admin_space(space_id));
