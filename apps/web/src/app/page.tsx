import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/api";

export default async function Home() {
  const me = await currentUser();
  redirect(me ? "/today" : "/login");
}
