import { redirect } from "next/navigation";
import { cache } from "react";
import type { AdminMeDto } from "@fitr8/contracts";
import { ApiError, currentUser, serverApi } from "@/lib/server/api";

/** Server calls to /api/admin/*; signed out → /admin/login. */
export function adminServerApi<T>(path: string): Promise<T> {
  return serverApi<T>(`/admin${path}`, { signInPath: "/admin/login" });
}

/** The blog section: /api/admin/blog/*. */
export const blogServerApi = <T>(path: string) => adminServerApi<T>(`/blog${path}`);

export type AdminAccess =
  | { ok: true; me: AdminMeDto; email: string | null }
  | { ok: false; reason: string; email: string | null };

/** Who is using the admin, deduped per request. Signed out → /admin/login; not staff → reason. */
export const adminAccess = cache(async (): Promise<AdminAccess> => {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  try {
    return { ok: true, me: await adminServerApi<AdminMeDto>("/me"), email: user.email ?? null };
  } catch (err) {
    if (err instanceof ApiError && err.status === 403)
      return { ok: false, reason: err.message, email: user.email ?? null };
    throw err;
  }
});

/**
 * The staff member; otherwise a redirect to /admin/no-access (outside the panel, so the layout and
 * the page, which Next renders in parallel, both land on the same place).
 */
export async function requireStaff(): Promise<AdminMeDto> {
  const access = await adminAccess();
  if (!access.ok) redirect("/admin/no-access");
  return access.me;
}
