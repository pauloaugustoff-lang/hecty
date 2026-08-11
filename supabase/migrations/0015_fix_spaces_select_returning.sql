-- Corrige um bug real: a política de SELECT de spaces (is_space_member)
-- é avaliada pela cláusula RETURNING do próprio INSERT antes do gatilho
-- on_space_created (AFTER INSERT) criar a associação de proprietário —
-- então quem acabou de criar um espaço não conseguia recebê-lo de volta
-- na mesma chamada (INSERT ... RETURNING falhava com violação de RLS).
-- Adicionar owner_id = auth.uid() como condição alternativa resolve isso
-- sem enfraquecer o isolamento: o dono sempre pode ver o próprio espaço.

drop policy if exists spaces_select on spaces;

create policy spaces_select on spaces for select
  using (is_space_member(id) or owner_id = auth.uid());
