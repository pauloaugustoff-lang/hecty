import { redirect } from "next/navigation";
import { requireCurrentSpace } from "@/lib/spaces/current-space";
import { createClient } from "@/lib/supabase/server";
import { listSpaceMembers, listSpaceInvites } from "@/lib/data/members";
import { memberRoleLabels } from "@/lib/domain/labels";
import { PageHeader } from "@/components/layout/page-header";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InviteForm } from "./invite-form";
import { MemberRowActions } from "./member-row-actions";
import { RevokeInviteButton } from "./revoke-invite-button";

export default async function MembrosPage() {
  const space = await requireCurrentSpace();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [members, invites] = await Promise.all([listSpaceMembers(space.id), listSpaceInvites(space.id)]);
  const pendingInvites = invites.filter((i) => i.status === "pendente");

  return (
    <div className="max-w-3xl">
      <PageHeader title="Membros e convites" description={`Quem tem acesso ao espaço "${space.name}".`} />

      <div className="mb-8">
        <InviteForm spaceId={space.id} />
      </div>

      <div className="mb-8 rounded-[var(--radius-lg)] border border-border-subtle">
        <Table>
          <Thead>
            <Tr>
              <Th>Nome</Th>
              <Th>Papel</Th>
              <Th className="w-56" />
            </Tr>
          </Thead>
          <Tbody>
            {members.map((member) => (
              <Tr key={member.id}>
                <Td className="font-medium">{member.fullName}</Td>
                <Td>
                  <Badge tone="neutral">{memberRoleLabels[member.role as keyof typeof memberRoleLabels]}</Badge>
                </Td>
                <Td>
                  <MemberRowActions memberId={member.id} role={member.role as never} isSelf={member.userId === user.id} />
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </div>

      {pendingInvites.length > 0 ? (
        <div>
          <h2 className="mb-3 font-display text-base font-medium text-text-primary">Convites pendentes</h2>
          <div className="divide-y divide-border-subtle rounded-[var(--radius-lg)] border border-border-subtle">
            {pendingInvites.map((invite) => (
              <div key={invite.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>
                  {invite.email} <span className="text-text-tertiary">· {memberRoleLabels[invite.role as keyof typeof memberRoleLabels]}</span>
                </span>
                <RevokeInviteButton inviteId={invite.id} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
