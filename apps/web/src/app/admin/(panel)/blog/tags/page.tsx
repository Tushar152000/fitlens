import { redirect } from "next/navigation";
import type { BlogTagDto } from "@fitr8/contracts";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { PageHead } from "@/components/admin/ui";
import { blogServerApi, requireStaff } from "@/lib/admin/server";

export const metadata = { title: "Tags" };

export default async function Tags() {
  const me = await requireStaff();
  if (!me.sections.blog.manageContent) redirect("/admin");
  const tags = await blogServerApi<BlogTagDto[]>("/tags");
  return (
    <>
      <PageHead
        title="Tags"
        lead="Finer labels (paneer, home workout…). A post can have several."
      />
      <TaxonomyManager kind="tags" initial={tags} />
    </>
  );
}
