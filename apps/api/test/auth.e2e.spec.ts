import { createHash, randomBytes, randomUUID } from "node:crypto";
import type request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./support/app.js";

type Agent = ReturnType<typeof request.agent>;
type Res = Awaited<ReturnType<Agent["get"]>>;

const WEB = "http://localhost:3000";
const APP_REDIRECT = "fitlens://auth";
const sha256Hex = (v: string) => createHash("sha256").update(v).digest("hex");
const challengeOf = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");
const newVerifier = () => randomBytes(32).toString("base64url");
const setCookies = (res: Res) => ([] as string[]).concat(res.headers["set-cookie"] ?? []);
const cookieValue = (res: Res, name: string) =>
  setCookies(res)
    .find((c) => c.startsWith(`${name}=`))
    ?.split(";")[0]!
    .slice(name.length + 1);
/** The response told the browser to delete this cookie. */
const clears = (res: Res, name: string) => setCookies(res).some((c) => c.startsWith(`${name}=;`));
const errorOf = (location: string) => new URL(location).searchParams.get("error");

describe("auth", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  /** Opens a sign-in URL and reads what we sent to Google. */
  async function startAt(agent: Agent, path: string) {
    const res = await agent.get(path).expect(302);
    const url = new URL(res.headers.location as string);
    return {
      res,
      url,
      state: url.searchParams.get("state")!,
      nonce: url.searchParams.get("nonce")!,
      challenge: url.searchParams.get("code_challenge")!,
    };
  }

  /** The full web flow; returns the callback response. */
  async function webSignIn(
    agent: Agent,
    identity: Record<string, unknown> = {},
    returnTo = "/today",
    userAgent = "Mozilla/5.0 (FitLens e2e)",
  ) {
    const s = await startAt(agent, `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`);
    const code = t.google.issueCode({ ...identity, nonce: s.nonce }, s.challenge);
    return agent
      .get("/api/auth/callback/google")
      .set("User-Agent", userAgent)
      .query({ code, state: s.state })
      .expect(302);
  }

  /** The app flow up to the redirect back into the app. */
  async function appCallback(
    browser: Agent,
    verifier: string,
    identity: Record<string, unknown> = {},
  ) {
    const s = await startAt(
      browser,
      `/api/auth/mobile/start?challenge=${challengeOf(verifier)}&redirect=${encodeURIComponent(APP_REDIRECT)}`,
    );
    const code = t.google.issueCode({ ...identity, nonce: s.nonce }, s.challenge);
    const res = await browser
      .get("/api/auth/callback/google")
      .query({ code, state: s.state })
      .expect(302);
    return new URL(res.headers.location as string);
  }

  async function appSignIn(identity: Record<string, unknown> = {}) {
    const verifier = newVerifier();
    const back = await appCallback(t.browser(), verifier, identity);
    const res = await t
      .http()
      .post("/api/auth/mobile/token")
      .send({ code: back.searchParams.get("code"), verifier })
      .expect(200);
    return res.body as { token: string; expiresAt: string };
  }

  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  describe("providers", () => {
    it("lists the sign-in methods and is never cached", async () => {
      const res = await t.http().get("/api/auth/providers").expect(200);
      expect(res.body).toEqual({ google: true, dev: true });
      expect(res.headers["cache-control"]).toBe("no-store");
    });
  });

  describe("web sign-in with Google", () => {
    it("sends the browser to Google with state, nonce and PKCE, and seals the rest in a cookie", async () => {
      const s = await startAt(t.browser(), "/api/auth/google?returnTo=/progress");
      expect(s.url.origin).toBe("https://accounts.google.test");
      expect(s.url.searchParams.get("redirect_uri")).toBe(`${WEB}/api/auth/callback/google`);
      expect(s.url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(s.state).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(s.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(s.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
      const cookie = setCookies(s.res).find((c) => c.startsWith("fitlens_signin="))!;
      expect(cookie).toMatch(/Path=\/api\/auth/);
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Lax/);
      // Sealed: neither the return path nor the state is readable in the cookie.
      expect(
        Buffer.from(cookieValue(s.res, "fitlens_signin")!, "base64url").toString(),
      ).not.toMatch(/progress|state/);
      expect(s.res.headers["cache-control"]).toBe("no-store");
    });

    it("signs a new user in, creates their account and lands on returnTo", async () => {
      const browser = t.browser();
      const email = `${randomUUID()}@gmail.test`;
      const subject = `sub-${randomUUID()}`;
      const res = await webSignIn(browser, { subject, email, name: "Asha" }, "/progress?tab=week");

      expect(res.headers.location).toBe(`${WEB}/progress?tab=week`);
      const sessionCookie = setCookies(res).find((c) => c.startsWith("fitlens_session="))!;
      expect(sessionCookie).toMatch(/Path=\/;/);
      expect(sessionCookie).toMatch(/HttpOnly/);
      expect(sessionCookie).toMatch(/SameSite=Lax/);
      expect(sessionCookie).toMatch(/Expires=/);
      expect(clears(res, "fitlens_signin")).toBe(true);

      const me = await browser.get("/api/me").expect(200);
      expect(me.body).toMatchObject({ email, name: "Asha", onboarded: false });

      const identity = await t.prisma.authIdentity.findUniqueOrThrow({
        where: { provider_subject: { provider: "GOOGLE", subject } },
      });
      expect(identity).toMatchObject({ userId: me.body.id, email });
      const user = await t.prisma.user.findUniqueOrThrow({ where: { id: me.body.id } });
      expect(user.emailVerified).toBeInstanceOf(Date);

      // Only the hash is stored.
      const token = cookieValue(res, "fitlens_session")!;
      const session = await t.prisma.session.findUniqueOrThrow({
        where: { tokenHash: sha256Hex(token) },
      });
      expect(session).toMatchObject({ userId: me.body.id, client: "WEB" });
      expect(await t.prisma.session.count({ where: { tokenHash: token } })).toBe(0);

      const events = await t.prisma.authEvent.findMany({ where: { userId: me.body.id } });
      expect(events.map((e) => [e.type, e.client])).toEqual([["SIGN_IN", "WEB"]]);
    });

    it("signs a returning user into the same account", async () => {
      const subject = `sub-${randomUUID()}`;
      const email = `${randomUUID()}@gmail.test`;
      const a = t.browser();
      const b = t.browser();
      await webSignIn(a, { subject, email });
      await webSignIn(b, { subject, email: `changed-${email}` });
      const [meA, meB] = await Promise.all([a.get("/api/me"), b.get("/api/me")]);
      expect(meB.body.id).toBe(meA.body.id);
      expect(await t.prisma.authIdentity.count({ where: { userId: meA.body.id } })).toBe(1);
      const identity = await t.prisma.authIdentity.findFirstOrThrow({
        where: { userId: meA.body.id },
      });
      expect(identity.email).toBe(`changed-${email}`);
    });

    it("links Google to an existing account with the same verified email", async () => {
      const email = `${randomUUID()}@test.fitlens`;
      const dev = await t.http().post("/api/auth/dev").send({ email }).expect(200);
      const browser = t.browser();
      await webSignIn(browser, { email: email.toUpperCase() });
      const me = await browser.get("/api/me").expect(200);
      expect(me.body.id).toBe(dev.body.userId);
    });

    it("refuses an unverified email, and an email owned by a different Google account", async () => {
      const unverified = await webSignIn(t.browser(), { emailVerified: false });
      expect(unverified.headers.location).toMatch(`${WEB}/login?error=`);
      expect(errorOf(unverified.headers.location)).toMatch(/isn't verified/);

      const email = `${randomUUID()}@gmail.test`;
      await webSignIn(t.browser(), { subject: `sub-${randomUUID()}`, email });
      const takeover = await webSignIn(t.browser(), { subject: `sub-${randomUUID()}`, email });
      expect(errorOf(takeover.headers.location)).toBe(
        "This email is already linked to a different Google account",
      );
      expect(cookieValue(takeover, "fitlens_session")).toBeUndefined();
    });

    it("never redirects off-site after sign-in", async () => {
      for (const returnTo of ["//evil.example/x", "https://evil.example", "/\\evil.example"]) {
        const res = await webSignIn(t.browser(), {}, returnTo);
        expect(res.headers.location).toBe(`${WEB}/today`);
      }
    });

    it("rejects a forged, missing or replayed state", async () => {
      const browser = t.browser();
      const s = await startAt(browser, "/api/auth/google");
      const code = t.google.issueCode({ nonce: s.nonce }, s.challenge);

      const forged = await browser
        .get("/api/auth/callback/google")
        .query({ code, state: "x".repeat(43) })
        .expect(302);
      expect(errorOf(forged.headers.location)).toBe("Sign-in expired, try again");

      // The state cookie is single use: cleared by the first callback, so a replay has nothing to match.
      const replay = await browser
        .get("/api/auth/callback/google")
        .query({ code, state: s.state })
        .expect(302);
      expect(errorOf(replay.headers.location)).toBe("Sign-in expired, try again");

      // A different browser (no state cookie) can't finish someone else's sign-in (login CSRF).
      const s2 = await startAt(t.browser(), "/api/auth/google");
      const code2 = t.google.issueCode({ nonce: s2.nonce }, s2.challenge);
      const stranger = await t
        .browser()
        .get("/api/auth/callback/google")
        .query({ code: code2, state: s2.state })
        .expect(302);
      expect(errorOf(stranger.headers.location)).toBe("Sign-in expired, try again");

      const failures = await t.prisma.authEvent.count({
        where: { type: "SIGN_IN_FAILED", reason: { in: ["state_mismatch", "state_missing"] } },
      });
      expect(failures).toBeGreaterThanOrEqual(3);
    });

    it("reports a cancelled sign-in, a Google error and a missing code", async () => {
      const cases: [Record<string, string>, string][] = [
        [{ error: "access_denied" }, "Sign-in was cancelled"],
        [{ error: "server_error" }, "Google sign-in failed, try again"],
        [{}, "Google sign-in failed, try again"],
      ];
      for (const [query, message] of cases) {
        const browser = t.browser();
        const s = await startAt(browser, "/api/auth/google");
        const res = await browser
          .get("/api/auth/callback/google")
          .query({ ...query, state: s.state })
          .expect(302);
        expect(errorOf(res.headers.location)).toBe(message);
      }
    });

    it("rejects an ID token minted for a different sign-in (nonce) and a bad code", async () => {
      const browser = t.browser();
      const s = await startAt(browser, "/api/auth/google");
      const code = t.google.issueCode({ nonce: "someone-elses-nonce" }, s.challenge);
      const res = await browser
        .get("/api/auth/callback/google")
        .query({ code, state: s.state })
        .expect(302);
      expect(errorOf(res.headers.location)).toBe("Google sign-in failed, try again");

      const b2 = t.browser();
      const s2 = await startAt(b2, "/api/auth/google");
      const bad = await b2
        .get("/api/auth/callback/google")
        .query({ code: "made-up", state: s2.state })
        .expect(302);
      expect(errorOf(bad.headers.location)).toBe("Google sign-in failed, try again");
    });

    it("replaces the browser's previous session instead of leaving it alive", async () => {
      const { agent, token } = await t.signIn();
      await webSignIn(agent);
      await t.http().get("/api/me").set(bearer(token)).expect(401);
      await agent.get("/api/me").expect(200);
    });
  });

  describe("app sign-in (PKCE hand-off)", () => {
    it("validates the start request", async () => {
      const challenge = challengeOf(newVerifier());
      const start = (q: string) => t.http().get(`/api/auth/mobile/start${q}`);
      await start("").expect(400);
      await start(`?challenge=short&redirect=${APP_REDIRECT}`).expect(400);
      await start(`?challenge=${challenge}`).expect(400);
      for (const redirect of ["https://evil.example/cb", "javascript:alert(1)", "not a url"]) {
        await start(`?challenge=${challenge}&redirect=${encodeURIComponent(redirect)}`).expect(
          400,
          {
            error: "Invalid sign-in request",
          },
        );
      }
    });

    it("hands the app a one-time code and trades it for a bearer session", async () => {
      const verifier = newVerifier();
      const back = await appCallback(t.browser(), verifier, { name: "Ravi" });
      expect(`${back.protocol}//${back.host}`).toBe(APP_REDIRECT);
      const code = back.searchParams.get("code")!;
      expect(code).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(await t.prisma.authCode.count({ where: { codeHash: code } })).toBe(0);

      const res = await t
        .http()
        .post("/api/auth/mobile/token")
        .send({ code, verifier })
        .expect(200);
      expect(res.body).toEqual({ token: expect.any(String), expiresAt: expect.any(String) });
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.headers["set-cookie"]).toBeUndefined();
      const days = (Date.parse(res.body.expiresAt) - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(89);
      expect(days).toBeLessThanOrEqual(90);

      const me = await t.http().get("/api/me").set(bearer(res.body.token)).expect(200);
      expect(me.body.name).toBe("Ravi");
      const session = await t.prisma.session.findUniqueOrThrow({
        where: { tokenHash: sha256Hex(res.body.token) },
      });
      expect(session.client).toBe("MOBILE");
    });

    it("lets a code work exactly once, and only with the right verifier", async () => {
      const verifier = newVerifier();
      const code = (await appCallback(t.browser(), verifier)).searchParams.get("code")!;
      await t.http().post("/api/auth/mobile/token").send({ code, verifier }).expect(200);
      await t
        .http()
        .post("/api/auth/mobile/token")
        .send({ code, verifier })
        .expect(400, { error: "Bad sign-in code" });

      // A stolen code is useless without the verifier, and a wrong guess burns it.
      const v2 = newVerifier();
      const code2 = (await appCallback(t.browser(), v2)).searchParams.get("code")!;
      await t
        .http()
        .post("/api/auth/mobile/token")
        .send({ code: code2, verifier: newVerifier() })
        .expect(400, { error: "Bad sign-in code" });
      await t.http().post("/api/auth/mobile/token").send({ code: code2, verifier: v2 }).expect(400);
    });

    it("refuses an expired code and malformed bodies", async () => {
      const verifier = newVerifier();
      const code = (await appCallback(t.browser(), verifier)).searchParams.get("code")!;
      await t.prisma.authCode.update({
        where: { codeHash: sha256Hex(code) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await t
        .http()
        .post("/api/auth/mobile/token")
        .send({ code, verifier })
        .expect(400, { error: "Sign-in code expired, try again" });

      await t.http().post("/api/auth/mobile/token").send({}).expect(400);
      await t
        .http()
        .post("/api/auth/mobile/token")
        .send({ code: "x", verifier: "short" })
        .expect(400);
    });

    it("sends failures back to the app, not the website", async () => {
      const browser = t.browser();
      const s = await startAt(
        browser,
        `/api/auth/mobile/start?challenge=${challengeOf(newVerifier())}&redirect=${APP_REDIRECT}`,
      );
      const res = await browser
        .get("/api/auth/callback/google")
        .query({ error: "access_denied", state: s.state })
        .expect(302);
      expect(res.headers.location).toMatch(/^fitlens:\/\/auth\?error=/);
      expect(errorOf(res.headers.location)).toBe("Sign-in was cancelled");
    });

    it("always goes through Google, even when the browser is signed in", async () => {
      const { agent } = await t.signIn();
      const res = await agent
        .get(
          `/api/auth/mobile/start?challenge=${challengeOf(newVerifier())}&redirect=${APP_REDIRECT}`,
        )
        .expect(302);
      expect(res.headers.location).toMatch(/^https:\/\/accounts\.google\.test\//);
    });
  });

  describe("sessions", () => {
    it("require sign-in", async () => {
      await t.http().get("/api/auth/sessions").expect(401);
      await t.http().delete(`/api/auth/sessions/${randomUUID()}`).expect(401);
      await t.http().post("/api/auth/signout-all").expect(401);
      await t.http().get("/api/me").set(bearer("not-a-real-token")).expect(401);
      await t
        .http()
        .get("/api/me")
        .set(bearer("x".repeat(2000)))
        .expect(401);
    });

    it("lists the user's devices, newest first, marking this one", async () => {
      const email = `${randomUUID()}@gmail.test`;
      const subject = `sub-${randomUUID()}`;
      const browser = t.browser();
      await webSignIn(browser, { email, subject }, "/today", "Mozilla/5.0 (Macintosh) Safari/605");
      const app = await appSignIn({ email, subject });
      await t.prisma.session.updateMany({
        where: { tokenHash: sha256Hex(app.token) },
        data: { lastSeenAt: new Date(Date.now() + 1000) },
      });

      const res = await browser.get("/api/auth/sessions").expect(200);
      expect(res.headers["cache-control"]).toBe("no-store");
      expect(res.body).toHaveLength(2);
      expect(res.body.map((s: { client: string }) => s.client)).toEqual(["MOBILE", "WEB"]);
      expect(res.body.map((s: { current: boolean }) => s.current)).toEqual([false, true]);
      expect(res.body[1]).toEqual({
        id: expect.any(String),
        client: "WEB",
        userAgent: "Mozilla/5.0 (Macintosh) Safari/605",
        ip: expect.stringMatching(/::$|\.0$/),
        createdAt: expect.any(String),
        lastSeenAt: expect.any(String),
        expiresAt: expect.any(String),
        current: true,
      });

      const fromApp = await t.http().get("/api/auth/sessions").set(bearer(app.token)).expect(200);
      expect(fromApp.body.map((s: { current: boolean }) => s.current)).toEqual([true, false]);
    });

    it("signs one device out; another user's session is a 404", async () => {
      const email = `${randomUUID()}@gmail.test`;
      const subject = `sub-${randomUUID()}`;
      const browser = t.browser();
      await webSignIn(browser, { email, subject });
      const app = await appSignIn({ email, subject });
      const stranger = await t.signIn();

      const mine = await browser.get("/api/auth/sessions").expect(200);
      const appSession = mine.body.find((s: { client: string }) => s.client === "MOBILE");
      const theirs = await stranger.agent.get("/api/auth/sessions").expect(200);

      await browser
        .delete(`/api/auth/sessions/${theirs.body[0].id}`)
        .expect(404, { error: "Session not found" });
      await stranger.agent.get("/api/me").expect(200);

      await browser.delete(`/api/auth/sessions/${appSession.id}`).expect(204);
      await t.http().get("/api/me").set(bearer(app.token)).expect(401);
      await browser.get("/api/me").expect(200);
      await browser.delete(`/api/auth/sessions/${appSession.id}`).expect(404);

      // Revoking the current session signs this client out and clears its cookie.
      const current = (await browser.get("/api/auth/sessions").expect(200)).body[0];
      const res = await browser.delete(`/api/auth/sessions/${current.id}`).expect(204);
      expect(clears(res, "fitlens_session")).toBe(true);
      await browser.get("/api/me").expect(401);
    });

    it("signs out everywhere", async () => {
      const email = `${randomUUID()}@gmail.test`;
      const subject = `sub-${randomUUID()}`;
      const browser = t.browser();
      await webSignIn(browser, { email, subject });
      const app = await appSignIn({ email, subject });
      const stranger = await t.signIn();

      await t.http().post("/api/auth/signout-all").set(bearer(app.token)).expect(204);
      await t.http().get("/api/me").set(bearer(app.token)).expect(401);
      await browser.get("/api/me").expect(401);
      await stranger.agent.get("/api/me").expect(200);
    });

    it("slides the idle expiry forward on use, at most once a day", async () => {
      const { token, userId } = await t.signIn();
      const where = { tokenHash: sha256Hex(token) };
      const before = await t.prisma.session.findUniqueOrThrow({ where });

      await t.http().get("/api/me").set(bearer(token)).expect(200);
      expect(await t.prisma.session.findUniqueOrThrow({ where })).toMatchObject({
        lastSeenAt: before.lastSeenAt,
        expiresAt: before.expiresAt,
      });

      const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000);
      await t.prisma.session.update({
        where,
        data: { lastSeenAt: twoDaysAgo, expiresAt: new Date(Date.now() + 86_400_000) },
      });
      await t.http().get("/api/me").set(bearer(token)).expect(200);
      const after = await t.prisma.session.findUniqueOrThrow({ where });
      expect(after.lastSeenAt.getTime()).toBeGreaterThan(twoDaysAgo.getTime());
      expect(after.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
      expect(after.userId).toBe(userId);
    });

    it("ends idle and too-old sessions, and drops a dead cookie", async () => {
      const idle = await t.signIn();
      await t.prisma.session.update({
        where: { tokenHash: sha256Hex(idle.token) },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const res = await idle.agent.get("/api/me").expect(401, { error: "Not signed in" });
      expect(clears(res, "fitlens_session")).toBe(true);

      const old = await t.signIn();
      await t.prisma.session.update({
        where: { tokenHash: sha256Hex(old.token) },
        data: { absoluteExpiresAt: new Date(Date.now() - 1000) },
      });
      await t.http().get("/api/me").set(bearer(old.token)).expect(401);
    });
  });

  describe("sign-out", () => {
    it("ends a bearer session", async () => {
      const app = await appSignIn();
      await t.http().post("/api/auth/signout").set(bearer(app.token)).expect(204);
      await t.http().get("/api/me").set(bearer(app.token)).expect(401);
      // Idempotent.
      await t.http().post("/api/auth/signout").set(bearer(app.token)).expect(204);
    });

    it("ends a cookie session and clears the cookie", async () => {
      const { agent, userId } = await t.signIn();
      const res = await agent.post("/api/auth/signout").set("Origin", WEB).expect(204);
      expect(clears(res, "fitlens_session")).toBe(true);
      await agent.get("/api/me").expect(401);
      const types = (await t.prisma.authEvent.findMany({ where: { userId } })).map((e) => e.type);
      expect(types).toContain("SIGN_OUT");
    });

    it("is fine when not signed in", async () => {
      await t.http().post("/api/auth/signout").expect(204);
    });
  });

  describe("cross-site request protection", () => {
    it("blocks cookie-authenticated writes from other sites", async () => {
      const { agent } = await t.signIn();
      await agent
        .patch("/api/profile/reminders")
        .set("Origin", "https://evil.example")
        .set("Sec-Fetch-Site", "cross-site")
        .send({ water: true })
        .expect(403, { error: "This request came from another site and was blocked" });
      await agent.post("/api/auth/signout-all").set("Origin", "https://evil.example").expect(403);
      await agent.get("/api/me").expect(200);
    });

    it("allows our own pages, non-browser clients and bearer tokens", async () => {
      const first = await t.signIn();
      await first.agent.post("/api/auth/signout-all").set("Origin", WEB).expect(204);

      const second = await t.signIn();
      await second.agent
        .post("/api/auth/signout-all")
        .set("Sec-Fetch-Site", "same-origin")
        .expect(204);

      const third = await t.signIn();
      await third.agent.post("/api/auth/signout-all").expect(204);

      // The app: a bearer token can't be attached by another site, so Origin doesn't matter.
      const app = await appSignIn();
      await t
        .http()
        .post("/api/auth/signout")
        .set(bearer(app.token))
        .set("Origin", "https://evil.example")
        .expect(204);
      await t.http().get("/api/me").set(bearer(app.token)).expect(401);
    });
  });

  describe("account deletion", () => {
    it("removes the user's sessions, identities and codes", async () => {
      const email = `${randomUUID()}@gmail.test`;
      const subject = `sub-${randomUUID()}`;
      const browser = t.browser();
      await webSignIn(browser, { email, subject });
      const app = await appSignIn({ email, subject });
      const { id: userId } = (await browser.get("/api/me").expect(200)).body;

      await t.http().delete("/api/account").set(bearer(app.token)).expect(204);
      await browser.get("/api/me").expect(401);
      expect(await t.prisma.session.count({ where: { userId } })).toBe(0);
      expect(await t.prisma.authIdentity.count({ where: { userId } })).toBe(0);
      expect(await t.prisma.authEvent.count({ where: { userId } })).toBe(0);
    });
  });

  describe("housekeeping", () => {
    it("deletes expired sessions and codes and old events, keeping live ones", async () => {
      const { AuthCleanupService } = await import("../src/modules/auth/auth-cleanup.service.js");
      const live = await t.signIn();
      const dead = await t.signIn();
      const past = new Date(Date.now() - 1000);
      await t.prisma.session.update({
        where: { tokenHash: sha256Hex(dead.token) },
        data: { expiresAt: past },
      });
      const code = await t.prisma.authCode.create({
        data: {
          codeHash: sha256Hex(randomUUID()),
          userId: live.userId,
          challenge: "c".repeat(43),
          redirectUri: APP_REDIRECT,
          expiresAt: past,
        },
      });
      const oldEvent = await t.prisma.authEvent.create({
        data: {
          type: "SIGN_IN",
          userId: live.userId,
          createdAt: new Date(Date.now() - 91 * 86_400_000),
        },
      });

      const result = await t.app.get(AuthCleanupService).run();
      expect(result).toMatchObject({
        sessions: expect.any(Number),
        codes: expect.any(Number),
        events: expect.any(Number),
      });
      expect(await t.prisma.session.count({ where: { userId: dead.userId } })).toBe(0);
      expect(await t.prisma.session.count({ where: { userId: live.userId } })).toBe(1);
      expect(await t.prisma.authCode.count({ where: { codeHash: code.codeHash } })).toBe(0);
      expect(await t.prisma.authEvent.count({ where: { id: oldEvent.id } })).toBe(0);
      expect(await t.prisma.authEvent.count({ where: { userId: live.userId } })).toBeGreaterThan(0);
    });
  });

  describe("dev login", () => {
    it("validates input and reuses the account for the same email", async () => {
      await t.http().post("/api/auth/dev").send({ email: "nope" }).expect(400);
      const email = `${randomUUID()}@TEST.fitlens`;
      const a = await t.http().post("/api/auth/dev").send({ email }).expect(200);
      const b = await t
        .http()
        .post("/api/auth/dev")
        .send({ email: email.toLowerCase() })
        .expect(200);
      expect(b.body.userId).toBe(a.body.userId);
      expect(a.body).toEqual({
        userId: expect.any(String),
        token: expect.any(String),
        expiresAt: expect.any(String),
      });
    });
  });
});

describe("auth configuration", () => {
  it("rate limits sign-in routes per IP, but not the rest of the API", async () => {
    const t = await createTestApp({ env: { AUTH_RATE_LIMIT: "3" } });
    try {
      for (let i = 0; i < 3; i++) await t.http().get("/api/auth/providers").expect(200);
      await t.http().get("/api/auth/providers").expect(429);
      for (let i = 0; i < 5; i++) await t.http().get("/api/health/live").expect(200);
    } finally {
      await t.close();
    }
  });

  it("hides dev login when it's off", async () => {
    const t = await createTestApp({ env: { AUTH_DEV_LOGIN: "false" } });
    try {
      await t
        .http()
        .post("/api/auth/dev")
        .send({ email: `${randomUUID()}@test.fitlens` })
        .expect(404);
      expect((await t.http().get("/api/auth/providers").expect(200)).body.dev).toBe(false);
    } finally {
      await t.close();
    }
  });

  it("uses __Host- prefixed, Secure cookies over https", async () => {
    const t = await createTestApp({ env: { PUBLIC_URL: "https://fitlens.test" } });
    try {
      const res = await t
        .http()
        .post("/api/auth/dev")
        .send({ email: `${randomUUID()}@test.fitlens` })
        .expect(200);
      const cookie = setCookies(res)[0]!;
      expect(cookie).toMatch(/^__Host-fitlens_session=/);
      expect(cookie).toMatch(/; Path=\/;/);
      expect(cookie).toMatch(/; Secure/);
      expect(cookie).not.toMatch(/Domain=/i);
      const start = await t.http().get("/api/auth/google").expect(302);
      expect(setCookies(start)[0]).toMatch(/^__Secure-fitlens_signin=.*; Secure/);
    } finally {
      await t.close();
    }
  });
});
