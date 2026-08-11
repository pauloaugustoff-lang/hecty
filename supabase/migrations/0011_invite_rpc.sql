-- Aceitar um convite de espaço financeiro. Roda como SECURITY DEFINER
-- porque o usuário convidado ainda não é membro do espaço (portanto não
-- passaria na política de insert de space_members, que exige papel de
-- administração). A função valida o token, o e-mail e a validade antes
-- de criar a associação.

create or replace function accept_space_invite(p_token uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite space_invites%rowtype;
  v_user_email text;
begin
  select * into v_invite from space_invites where token = p_token;

  if v_invite.id is null then
    raise exception 'convite não encontrado';
  end if;

  if v_invite.status <> 'pendente' then
    raise exception 'convite já foi utilizado ou revogado';
  end if;

  if v_invite.expires_at < now() then
    update space_invites set status = 'expirado' where id = v_invite.id;
    raise exception 'convite expirado';
  end if;

  v_user_email := auth.jwt() ->> 'email';

  if v_user_email is null or lower(v_user_email) <> lower(v_invite.email) then
    raise exception 'este convite pertence a outro e-mail';
  end if;

  insert into space_members (space_id, user_id, role, invited_by)
  values (v_invite.space_id, auth.uid(), v_invite.role, v_invite.invited_by)
  on conflict (space_id, user_id) do update set role = excluded.role;

  update space_invites
    set status = 'aceito', accepted_by = auth.uid()
    where id = v_invite.id;

  return v_invite.space_id;
end;
$$;

revoke all on function accept_space_invite(uuid) from public;
grant execute on function accept_space_invite(uuid) to authenticated;
