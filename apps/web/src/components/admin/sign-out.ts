import { api } from "@/lib/client/api";

/** Ends the session (the whole FITR8 account on this browser) and returns to the admin sign-in. */
export async function signOutOfAdmin() {
  await api("/api/auth/signout", { method: "POST" }).catch(() => undefined);
  window.location.assign(new URL("/admin/login", window.location.origin).href);
}
