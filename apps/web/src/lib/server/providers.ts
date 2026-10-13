import { apiBaseUrl } from "@/lib/api-base";
import type { ProvidersDto } from "@fitr8/contracts";

/** Which sign-in methods the API offers. If it can't be reached, still show Google. */
export async function signInProviders(): Promise<ProvidersDto> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/auth/providers`, { cache: "no-store" });
    if (res.ok) return (await res.json()) as ProvidersDto;
  } catch {
    // fall through
  }
  return { google: true, apple: false, dev: false };
}
