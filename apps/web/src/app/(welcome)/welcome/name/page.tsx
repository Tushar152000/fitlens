import { redirect } from "next/navigation";

/** The old step-1 URL; the name is now the first step of /welcome. */
export default function NamePage() {
  redirect("/welcome");
}
