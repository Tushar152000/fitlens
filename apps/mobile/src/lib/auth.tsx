import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthTokenDto, DevLoginDto } from "@fitr8/contracts";
import { api, ApiError, setApiToken, setUnauthorizedHandler } from "./api";
import { API_URL } from "./config";
import { queryClient } from "./query";
import { writeConversationId } from "./coach-store";
import { forgetPurchaser, identifyPurchaser } from "./purchases";
import { cancelWaterReminders } from "./reminders";
import { readToken, writeToken } from "./token-store";
import type { Me } from "./types";

type AuthState =
  | { status: "loading"; me: null }
  | { status: "signedOut"; me: null }
  /** A saved session exists but /api/me couldn't be reached (offline, server down): keep it and offer a retry. */
  | { status: "offline"; me: null }
  | { status: "signedIn"; me: Me };

type AuthContextValue = AuthState & {
  signIn: () => Promise<void>;
  /** iOS: the system Sign in with Apple sheet. Resolves quietly if the user cancels. */
  appleSignIn: () => Promise<void>;
  /** Local development only (the API offers it when not deployed): email sign-in, no Google. */
  devSignIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-reads /api/me, e.g. after onboarding finishes. */
  refresh: () => Promise<void>;
  /** From the offline screen: try /api/me again with the saved session. */
  retry: () => Promise<void>;
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
    await Promise.all([forgetPurchaser(), cancelWaterReminders().catch(() => undefined)]);
    setApiToken(null);
    queryClient.clear(); // never show the last user's data to the next one
    await Promise.all([writeToken(null), writeConversationId(null)]);
    setState({ status: "signedOut", me: null });
  }, []);

  const load = useCallback(async () => {
    try {
      const me = await api<Me>("/api/me");
      setState({ status: "signedIn", me });
      // Ties store purchases to this account; never blocks the app if RevenueCat is unreachable.
      identifyPurchaser(me.id).catch(() => undefined);
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
      // Only a 401 (handled in load) signs out; any other failure keeps the session for a retry.
      await load().catch(() => setState({ status: "offline", me: null }));
    })();
  }, [clear, load]);

  const signIn = useCallback(async () => {
    const { verifier, challenge } = await pkcePair();
    const redirect = Linking.createURL("auth");
    const start = `${API_URL}/api/auth/mobile/start?challenge=${challenge}&redirect=${encodeURIComponent(redirect)}`;
    const result = await WebBrowser.openAuthSessionAsync(start, redirect);
    if (result.type !== "success") return;
    const { code, error } = Linking.parse(result.url).queryParams ?? {};
    // The API sends a short, user-facing reason back when sign-in fails (e.g. "Sign-in was cancelled").
    if (typeof error === "string") throw new Error(error);
    if (typeof code !== "string") throw new Error("Sign-in didn't finish. Try again.");
    const { token } = await api<AuthTokenDto>("/api/auth/mobile/token", { json: { code, verifier } });
    setApiToken(token);
    await writeToken(token);
    await load();
  }, [load]);

  const appleSignIn = useCallback(async () => {
    // Apple puts SHA-256(nonce) in the identity token; the API checks it against the raw value.
    const nonce = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replace(/-/g, "");
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashed,
      });
    } catch (err) {
      if ((err as { code?: string }).code === "ERR_REQUEST_CANCELED") return;
      throw new Error("Apple sign-in didn't finish. Try again.");
    }
    if (!credential.identityToken) throw new Error("Apple sign-in didn't finish. Try again.");
    const { token } = await api<AuthTokenDto>("/api/auth/apple", {
      json: {
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode ?? undefined,
        nonce,
        // Apple shares the name only on the very first sign-in.
        fullName: credential.fullName
          ? { givenName: credential.fullName.givenName, familyName: credential.fullName.familyName }
          : undefined,
      },
    });
    setApiToken(token);
    await writeToken(token);
    await load();
  }, [load]);

  const devSignIn = useCallback(
    async (email: string) => {
      const { token } = await api<DevLoginDto>("/api/auth/dev", { json: { email } });
      setApiToken(token);
      await writeToken(token);
      await load();
    },
    [load],
  );

  const signOut = useCallback(async () => {
    await api("/api/auth/signout", { method: "POST" }).catch(() => {});
    await clear();
  }, [clear]);

  const retry = useCallback(async () => {
    await load().catch(() => setState({ status: "offline", me: null }));
  }, [load]);

  const value = useMemo(
    () => ({ ...state, signIn, appleSignIn, devSignIn, signOut, refresh: load, retry }),
    [state, signIn, appleSignIn, devSignIn, signOut, load, retry],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}
