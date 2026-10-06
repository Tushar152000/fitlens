import { notFound } from "next/navigation";
import { ApiError, requireOnboardedViewer, serverApi } from "@/lib/server/api";
import { ConfirmScreen, type MealDto } from "./confirm-screen";

export const metadata = { title: "Confirm meal — FITR8" };

/** Screen 8: review the AI's items, adjust portions, save. Initial data is server-rendered; the client polls while analysing. */
export default async function ConfirmMealPage({ params }: PageProps<"/log/[id]">) {
  await requireOnboardedViewer();
  const { id } = await params;
  let initial: MealDto;
  try {
    initial = await serverApi<MealDto>(`/meals/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  return <ConfirmScreen initial={initial} />;
}
