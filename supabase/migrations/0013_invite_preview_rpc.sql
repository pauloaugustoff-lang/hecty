-- Pré-visualização de um convite antes do aceite (nome do espaço, papel,
-- quem convidou), sem exigir que o usuário já seja membro do espaço.

create or replace function get_invite_preview(p_token uuid)
returns table (
  space_name text,
  role member_role,
  status invite_status,
  invited_by_name text,
  expires_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select s.name, i.role, i.status, p.full_name, i.expires_at
  from space_invites i
  join spaces s on s.id = i.space_id
  join profiles p on p.id = i.invited_by
  where i.token = p_token;
$$;

revoke execute on function get_invite_preview(uuid) from public;
grant execute on function get_invite_preview(uuid) to anon, authenticated;
