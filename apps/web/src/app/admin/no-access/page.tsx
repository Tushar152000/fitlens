import { redirect } from "next/navigation";
import { NoAccess } from "@/components/admin/no-access";
import { adminAccess } from "@/lib/admin/server";

export const metadata = { title: "No access" };

/** Signed in, but not FITR8 staff (staff are sent on to the admin home). */
export default async function NoAccessPage() {
  const access = await adminAccess();
  if (access.ok) redirect("/admin");
  return <NoAccess reason={access.reason} email={access.email} />;
}
