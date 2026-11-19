import { redirect } from "next/navigation";

/** An even older first-step URL. Everyone starts at /login now. */
export default function NamePage() {
  redirect("/login");
}
