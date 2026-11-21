import type {
  BlogAdminPostDto,
  BlogCategoryDto,
  BlogAuthorOptionDto,
  BlogTagDto,
} from "@fitr8/contracts";
import { notFound } from "next/navigation";
import { PostEditor } from "@/components/admin/editor/post-editor";
import { blogServerApi, requireStaff } from "@/lib/admin/server";
import { ApiError } from "@/lib/server/api";

export const metadata = { title: "Edit post" };

export default async function EditPost({ params }: PageProps<"/admin/blog/posts/[id]">) {
  const [{ id }, me] = await Promise.all([params, requireStaff()]);
  const [post, categories, tags, members] = await Promise.all([
    blogServerApi<BlogAdminPostDto>(`/posts/${encodeURIComponent(id)}`).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }),
    blogServerApi<BlogCategoryDto[]>("/categories"),
    blogServerApi<BlogTagDto[]>("/tags"),
    me.sections.blog.assignAuthor
      ? blogServerApi<BlogAuthorOptionDto[]>("/authors")
      : Promise.resolve([]),
  ]);
  if (!post) notFound();
  return (
    <PostEditor
      key={post.id}
      initial={post}
      me={me}
      categories={categories}
      tags={tags}
      members={members}
    />
  );
}
