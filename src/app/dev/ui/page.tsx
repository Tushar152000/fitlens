import { notFound } from "next/navigation";
import { UiGallery } from "./ui-gallery";

export const metadata = { title: "UI primitives — FitLens" };

/** Every primitive in one place, for visual checks. Dev only. */
export default function DevUiPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <UiGallery />;
}
