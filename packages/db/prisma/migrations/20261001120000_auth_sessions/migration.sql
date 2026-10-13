-- Auth rebuild: hashed sessions with device metadata and sliding expiry, provider identities
-- instead of Auth.js accounts, one-time app sign-in codes, and an auth audit log.
-- Existing sessions and Google links are carried over, so nobody is signed out.

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('GOOGLE');
CREATE TYPE "SessionClient" AS ENUM ('WEB', 'MOBILE');
CREATE TYPE "AuthEventType" AS ENUM ('SIGN_IN', 'SIGN_IN_FAILED', 'SIGN_OUT', 'SIGN_OUT_ALL', 'SESSION_REVOKED');

-- ── auth_identities (replaces accounts) ─────────────────────────────────
CREATE TABLE "auth_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "AuthProvider" NOT NULL,
    "subject" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSignInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_identities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auth_identities_userId_idx" ON "auth_identities"("userId");
CREATE UNIQUE INDEX "auth_identities_provider_subject_key" ON "auth_identities"("provider", "subject");
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Google links survive; provider OAuth tokens are deliberately not carried over (we never use them).
INSERT INTO "auth_identities" ("id", "userId", "provider", "subject", "email", "createdAt", "lastSignInAt")
SELECT gen_random_uuid()::text, a."userId", 'GOOGLE', a."providerAccountId", u."email", a."createdAt", a."updatedAt"
FROM "accounts" a
JOIN "users" u ON u."id" = a."userId"
WHERE a."provider" = 'google';

DROP TABLE "accounts";
DROP TABLE "verification_tokens";

-- ── sessions: store SHA-256(token), never the token ─────────────────────
ALTER TABLE "sessions" RENAME TO "sessions_old";
ALTER INDEX "sessions_sessionToken_key" RENAME TO "sessions_old_sessionToken_key";
ALTER TABLE "sessions_old" RENAME CONSTRAINT "sessions_userId_fkey" TO "sessions_old_userId_fkey";

CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "userId" TEXT NOT NULL,
    "client" "SessionClient" NOT NULL,
    "userAgent" VARCHAR(256),
    "ip" VARCHAR(64),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Live sessions only. App sessions were issued for 90 days, web ones for 30: tell them apart by length.
INSERT INTO "sessions" ("id", "tokenHash", "userId", "client", "createdAt", "lastSeenAt", "expiresAt", "absoluteExpiresAt")
SELECT
    gen_random_uuid()::text,
    encode(sha256(convert_to(s."sessionToken", 'UTF8')), 'hex'),
    s."userId",
    (CASE WHEN s."expires" - s."createdAt" > interval '45 days' THEN 'MOBILE' ELSE 'WEB' END)::"SessionClient",
    s."createdAt",
    s."updatedAt",
    s."expires",
    s."createdAt" + interval '365 days'
FROM "sessions_old" s
WHERE s."expires" > now();

DROP TABLE "sessions_old";

-- ── auth_codes: one-time app sign-in codes ──────────────────────────────
CREATE TABLE "auth_codes" (
    "codeHash" CHAR(64) NOT NULL,
    "userId" TEXT NOT NULL,
    "challenge" CHAR(43) NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_codes_pkey" PRIMARY KEY ("codeHash")
);
CREATE INDEX "auth_codes_expiresAt_idx" ON "auth_codes"("expiresAt");
ALTER TABLE "auth_codes" ADD CONSTRAINT "auth_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── auth_events: security audit log (90-day retention) ──────────────────
CREATE TABLE "auth_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "type" "AuthEventType" NOT NULL,
    "client" "SessionClient",
    "reason" VARCHAR(64),
    "ip" VARCHAR(64),
    "userAgent" VARCHAR(256),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "auth_events_userId_createdAt_idx" ON "auth_events"("userId", "createdAt");
CREATE INDEX "auth_events_createdAt_idx" ON "auth_events"("createdAt");
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
