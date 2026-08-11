-- Bucket privado para os arquivos enviados no assistente de importação.
-- Caminho de objeto: imports/{space_id}/{import_batch_id}/{nome_do_arquivo}
-- O primeiro segmento do caminho (space_id) delimita o isolamento por RLS.

insert into storage.buckets (id, name, public, file_size_limit)
values ('imports', 'imports', false, 20971520) -- 20 MB
on conflict (id) do nothing;

create policy imports_select on storage.objects for select
  to authenticated
  using (
    bucket_id = 'imports'
    and is_space_member((storage.foldername(name))[1]::uuid)
  );

create policy imports_insert on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'imports'
    and can_edit_space((storage.foldername(name))[1]::uuid)
  );

create policy imports_delete on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'imports'
    and can_admin_space((storage.foldername(name))[1]::uuid)
  );
