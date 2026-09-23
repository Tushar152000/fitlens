import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { presignRead } from "@/lib/storage/s3";
import { requireOnboardedViewer } from "@/lib/viewer";
import { ConfirmScreen, type MealDto } from "./confirm-screen";

export const metadata = { title: "Confirm meal — FitLens" };

/** Screen 8: review the AI's items, adjust portions, save. Initial data is server-rendered; the client polls while analysing. */
export default async function ConfirmMealPage({ params }: PageProps<"/log/[id]">) {
  const { userId } = await requireOnboardedViewer();
  const { id } = await params;
  const log = await prisma.mealLog.findFirst({ where: { id, userId }, include: { items: true } });
  if (!log) notFound();
  const photoUrl = log.photoKey ? await presignRead(log.photoKey, 3600).catch(() => null) : null;

  const initial: MealDto = JSON.parse(JSON.stringify({ ...log, photoUrl }));
  return <ConfirmScreen initial={initial} />;
}
