import type { BlogAuthorProfileDto } from "@fitr8/contracts";
import { ProfileForm } from "@/components/admin/profile-form";
import { PageHead } from "@/components/admin/ui";
import { blogServerApi, requireStaff } from "@/lib/admin/server";

export const metadata = { title: "Author profile" };

export default async function Profile() {
  await requireStaff();
  const profile = await blogServerApi<BlogAuthorProfileDto>("/profile");
  return (
    <>
      <PageHead
        title="Your author profile"
        lead="Readers see this under your posts and on your author page."
      />
      <ProfileForm profile={profile} />
    </>
  );
}
