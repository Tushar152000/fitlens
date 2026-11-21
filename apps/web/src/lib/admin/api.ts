import type { BlogMediaDto } from "@fitr8/contracts";
import { api } from "@/lib/client/api";

export { ApiError } from "@/lib/client/api";

/** Browser calls to /api/admin/*: a lost session goes back to the admin sign-in, not the app's. */
export function adminApi<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  return api<T>(`/api/admin${path}`, { ...init, signInPath: "/admin/login" });
}

/** The blog section of the admin: /api/admin/blog/*. */
export const blogApi = <T>(path: string, init?: RequestInit & { json?: unknown }) =>
  adminApi<T>(`/blog${path}`, init);

export const BLOG_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif";

/** Uploads an image to the blog library (signed PUT straight to storage) and returns it. */
export async function uploadBlogImage(file: File, alt?: string | null): Promise<BlogMediaDto> {
  const { media, uploadUrl } = await blogApi<{ media: BlogMediaDto; uploadUrl: string }>("/media", {
    method: "POST",
    json: { contentType: file.type, sizeBytes: file.size, alt: alt ?? null },
  });
  const put = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  }).catch(() => null);
  if (!put?.ok) {
    // Don't leave an empty entry in the library.
    await blogApi(`/media/${media.id}`, { method: "DELETE" }).catch(() => undefined);
    throw new Error("Upload failed. Check your connection and try again.");
  }
  return media;
}
