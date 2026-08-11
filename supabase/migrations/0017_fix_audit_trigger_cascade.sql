-- record_audit_event() falha quando dispara durante uma exclusão em
-- cascata do espaço inteiro (ex.: exclusão de um usuário na Auth, que
-- cascateia para spaces -> transactions/accounts/cards). Nesse cenário,
-- a linha de "spaces" já pode ter sido removida no momento em que o
-- trigger tenta inserir em audit_log, violando a FK audit_log_space_id_fkey.
-- Como o histórico de auditoria de um espaço que está sendo destruído por
-- completo não tem valor prático (nada resta pra auditar), a função passa
-- a ignorar silenciosamente esse caso, preservando o log normal para
-- exclusões/edições avulsas feitas pelos usuários.

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
exception
  when foreign_key_violation then
    if tg_op = 'DELETE' then
      return old;
    else
      return new;
    end if;
end;
$$;
