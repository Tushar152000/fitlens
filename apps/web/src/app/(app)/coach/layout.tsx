import { redirect } from "next/navigation";

/** Not on the web: logging and the coach live in the phone app (docs/WEBSITE.md §4). */
export default function Layout() {
  redirect("/home");
}
