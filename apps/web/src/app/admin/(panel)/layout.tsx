import { AdminNav } from "@/components/admin/admin-nav";
import { requireStaff } from "@/lib/admin/server";

/** Every admin screen: signed in (else /admin/login) and FITR8 staff (else /admin/no-access). */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff();
  return (
    <div className="min-h-dvh bg-ground">
      <AdminNav me={me} />
      <div className="lg:pl-64">
        <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">{children}</div>
      </div>
    </div>
  );
}
