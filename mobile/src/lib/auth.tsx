import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, setApiToken, setUnauthorizedHandler } from "./api";
import { API_URL } from "./config";
import { queryClient } from "./query";
import { readToken, writeToken } from "./token-store";
import type { Me } from "./types";

type AuthState =
  | { status: "loading"; me: null }
  | { status: "signedOut"; me: null }
  | { status: "signedIn"; me: Me };

type AuthContextValue = AuthState & {
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-reads /api/me, e.g. after onboarding finishes. */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = use(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** The signed-in user; only call below the signed-in guard. */
export function useMe(): Me {
  const { me } = useAuth();
  if (!me) throw new Error("useMe needs a signed-in user");
  return me;
}

const toBase64Url = (b64: string) => b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function pkcePair() {
  const bytes = Crypto.getRandomBytes(32);
  const verifier = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  return { verifier, challenge: toBase64Url(digest) };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", me: null });

  const clear = useCallback(async () => {
    setApiToken(null);
    queryClient.clear(); // never show the last user's data to the next one
    await writeToken(null);
    setState({ status: "signedOut", me: null });
  }, []);

  const load = useCallback(async () => {
    try {
      const me = await api<Me>("/api/me");
      setState({ status: "signedIn", me });
    } catch (err) {
      // Offline at launch: keep the token and let the user retry rather than signing them out.
      if (err instanceof ApiError && err.status === 401) await clear();
      else throw err;
    }
  }, [clear]);

  useEffect(() => {
    setUnauthorizedHandler(() => void clear());
    (async () => {
      const saved = await readToken();
      if (!saved) return setState({ status: "signedOut", me: null });
      setApiToken(saved);
      await load().catch(() => setState({ status: "signedOut", me: null }));
    })();
  }, [clear, load]);

  const signIn = useCallback(async () => {
    const { verifier, challenge } = await pkcePair();
    const redirect = Linking.createURL("auth");
    const start = `${API_URL}/api/mobile/start?challenge=${challenge}&redirect=${encodeURIComponent(redirect)}`;
    const result = await WebBrowser.openAuthSessionAsync(start, redirect);
    if (result.type !== "success") return;
    const code = Linking.parse(result.url).queryParams?.code;
    if (typeof code !== "string") throw new Error("Sign-in didn't finish. Try again.");
    const { token } = await api<{ token: string }>("/api/mobile/token", { json: { code, verifier } });
    setApiToken(token);
    await writeToken(token);
    await load();
  }, [load]);

  const signOut = useCallback(async () => {
    await api("/api/mobile/signout", { method: "POST" }).catch(() => {});
    await clear();
  }, [clear]);

  const value = useMemo(
    () => ({ ...state, signIn, signOut, refresh: load }),
    [state, signIn, signOut, load],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}
