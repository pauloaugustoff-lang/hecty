-- Colunas de auditoria (quem criou/convidou/desfez) referenciavam auth.users
-- sem "on delete" explícito, o que no Postgres vira "no action" (restrict).
-- Isso bloqueia a exclusão de um usuário na Auth sempre que ele tiver
-- criado algum lançamento, regra, importação ou convite — mesmo em um
-- espaço que já vai ser removido em cascata por outro caminho (owner_id).
-- Trocamos para "on delete set null": o registro financeiro (que pertence
-- ao espaço, não ao usuário) permanece intacto, só perde a referência de
-- quem o criou.

alter table import_batches alter column created_by drop not null;
alter table import_batches drop constraint import_batches_created_by_fkey;
alter table import_batches
  add constraint import_batches_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;

alter table import_batches drop constraint import_batches_undone_by_fkey;
alter table import_batches
  add constraint import_batches_undone_by_fkey
  foreign key (undone_by) references auth.users (id) on delete set null;

alter table space_members drop constraint space_members_invited_by_fkey;
alter table space_members
  add constraint space_members_invited_by_fkey
  foreign key (invited_by) references auth.users (id) on delete set null;

alter table space_invites alter column invited_by drop not null;
alter table space_invites drop constraint space_invites_invited_by_fkey;
alter table space_invites
  add constraint space_invites_invited_by_fkey
  foreign key (invited_by) references auth.users (id) on delete set null;

alter table space_invites drop constraint space_invites_accepted_by_fkey;
alter table space_invites
  add constraint space_invites_accepted_by_fkey
  foreign key (accepted_by) references auth.users (id) on delete set null;

alter table rules alter column created_by drop not null;
alter table rules drop constraint rules_created_by_fkey;
alter table rules
  add constraint rules_created_by_fkey
  foreign key (created_by) references auth.users (id) on delete set null;
