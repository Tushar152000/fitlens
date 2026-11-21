import type { StaffMemberDto } from "@fitr8/contracts";
import { TeamManager } from "@/components/admin/team-manager";
import { PageHead } from "@/components/admin/ui";
import { adminServerApi, requireStaff } from "@/lib/admin/server";

export const metadata = { title: "Team" };

/** Everyone can see the team; only admins change it. */
export default async function Team() {
  const me = await requireStaff();
  const staff = await adminServerApi<StaffMemberDto[]>("/staff");
  return (
    <>
      <PageHead
        title="Team"
        lead="Who can sign in to the FITR8 admin, and their role in every section (the blog, and what comes next)."
      />
      <TeamManager initial={staff} selfId={me.staff.id} canManage={me.can.manageTeam} />
    </>
  );
}
