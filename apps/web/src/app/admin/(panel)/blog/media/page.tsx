import type { BlogMediaDto } from "@fitr8/contracts";
import { MediaLibrary } from "@/components/admin/media-library";
import { PageHead } from "@/components/admin/ui";
import { blogServerApi, requireStaff } from "@/lib/admin/server";

export const metadata = { title: "Media" };

export default async function Media() {
  await requireStaff();
  const data = await blogServerApi<{
    media: BlogMediaDto[];
    page: number;
    pages: number;
    total: number;
  }>("/media");
  return (
    <>
      <PageHead
        title="Media"
        lead="Images are public once uploaded. Alt text is used wherever the image appears."
      />
      <MediaLibrary initial={data} />
    </>
  );
}
