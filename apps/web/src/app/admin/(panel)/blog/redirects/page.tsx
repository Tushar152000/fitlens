import { redirect } from "next/navigation";
import type { BlogRedirectDto } from "@fitr8/contracts";
import { RedirectManager } from "@/components/admin/redirect-manager";
import { PageHead } from "@/components/admin/ui";
import { blogServerApi, requireStaff } from "@/lib/admin/server";

export const metadata = { title: "Redirects" };

export default async function Redirects() {
  const me = await requireStaff();
  if (!me.sections.blog.manageContent) redirect("/admin");
  const list = await blogServerApi<BlogRedirectDto[]>("/redirects");
  return (
    <>
      <PageHead
        title="Redirects"
        lead="Keep old links and Google rankings when a URL changes (permanent 308 redirects)."
      />
      <RedirectManager initial={list} />
    </>
  );
}
