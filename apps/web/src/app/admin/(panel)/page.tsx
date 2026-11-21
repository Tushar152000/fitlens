import { ArrowRight, Newspaper, Users } from "lucide-react";
import Link from "next/link";
import type { BlogStatsDto, StaffMemberDto } from "@fitr8/contracts";
import { STAFF_ROLE_LABELS } from "@fitr8/domain/staff";
import { PageHead } from "@/components/admin/ui";
import { adminServerApi, blogServerApi, requireStaff } from "@/lib/admin/server";

export const metadata = { title: "Home" };

/** The admin's home: one card per section (the blog first) and the team. */
export default async function AdminHome() {
  const me = await requireStaff();
  const [blog, staff] = await Promise.all([
    blogServerApi<BlogStatsDto>("/stats"),
    adminServerApi<StaffMemberDto[]>("/staff"),
  ]);
  const invited = staff.filter((s) => !s.joined).length;

  return (
    <>
      <PageHead
        title={`Hi, ${me.staff.name.split(" ")[0]}`}
        lead={`FITR8 admin · signed in as ${STAFF_ROLE_LABELS[me.staff.role]}`}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SectionCard
          href="/admin/blog"
          icon={<Newspaper className="size-6" aria-hidden />}
          title="Blog"
          body="Articles at /blog for search: write, schedule and optimise posts."
          stats={[
            { label: "Published", value: blog.counts.PUBLISHED },
            { label: "Scheduled", value: blog.counts.SCHEDULED },
            { label: "Drafts", value: blog.counts.DRAFT },
          ]}
        />
        <SectionCard
          href="/admin/team"
          icon={<Users className="size-6" aria-hidden />}
          title="Team"
          body={
            me.can.manageTeam
              ? "Invite people and set their role for every section."
              : "Who's on the team and their roles."
          }
          stats={[
            { label: "People", value: staff.length },
            { label: "Invited", value: invited },
          ]}
        />
      </div>
      <p className="mt-8 text-[13px] text-ink-3">
        More sections (users, foods, reports…) will appear here as they are added to the admin.
      </p>
    </>
  );
}

function SectionCard({
  href,
  icon,
  title,
  body,
  stats,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  stats: { label: string; value: number }[];
}) {
  return (
    <Link
      href={href}
      className="group flex lift flex-col rounded-card border border-line bg-surface p-5"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-input bg-brand/10 text-brand">
          {icon}
        </span>
        <h2 className="display text-[20px]">{title}</h2>
        <ArrowRight
          className="ml-auto size-5 text-ink-3 transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
      <p className="mt-3 text-[14px] text-ink-2">{body}</p>
      <dl className="mt-4 flex gap-6">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[12px] font-semibold text-ink-3">{s.label}</dt>
            <dd className="display text-[26px] tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}
