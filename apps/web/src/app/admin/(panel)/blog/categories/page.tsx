import { redirect } from "next/navigation";
import type { BlogCategoryDto } from "@fitr8/contracts";
import { TaxonomyManager } from "@/components/admin/taxonomy-manager";
import { PageHead } from "@/components/admin/ui";
import { blogServerApi, requireStaff } from "@/lib/admin/server";

export const metadata = { title: "Categories" };

export default async function Categories() {
  const me = await requireStaff();
  if (!me.sections.blog.manageContent) redirect("/admin");
  const categories = await blogServerApi<BlogCategoryDto[]>("/categories");
  return (
    <>
      <PageHead
        title="Categories"
        lead="The main topics. Each post has one; each gets its own page at /blog/category/…"
      />
      <TaxonomyManager kind="categories" initial={categories} />
    </>
  );
}
