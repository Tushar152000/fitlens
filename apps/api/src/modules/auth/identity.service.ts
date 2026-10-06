import { Injectable } from "@nestjs/common";
import { Prisma, type AuthProvider } from "@fitr8/db";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { UsersService } from "../users/users.service.js";
import type { OidcIdentity } from "./google/oidc.js";

/** Why an identity can't sign in. Mapped to user-facing copy by AuthService. */
export class IdentityRejected extends Error {
  constructor(public readonly reason: "email_missing" | "email_unverified" | "email_taken") {
    super(reason);
    this.name = "IdentityRejected";
  }
}

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/**
 * Maps a verified provider identity to a FITR8 user.
 *
 * 1. Known (provider, subject) → that user. The subject never changes; the email can.
 * 2. Otherwise the provider must vouch for the email (email_verified), or we refuse: an unverified
 *    address would let anyone claim someone else's account.
 * 3. A user with that email → link this identity to them, unless they already have a *different*
 *    identity at the same provider (a recycled Workspace address belongs to a new person).
 * 4. No user → create one.
 *
 * Two first sign-ins racing each other hit a unique constraint; we re-run the lookup, which then
 * finds what the other request created.
 */
@Injectable()
export class IdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  async resolveUser(provider: AuthProvider, identity: OidcIdentity): Promise<string> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.resolveOnce(provider, identity);
      } catch (err) {
        if (attempt < 3 && isUniqueViolation(err)) continue;
        throw err;
      }
    }
  }

  private async resolveOnce(provider: AuthProvider, identity: OidcIdentity): Promise<string> {
    const now = new Date();
    const known = await this.prisma.authIdentity.findUnique({
      where: { provider_subject: { provider, subject: identity.subject } },
      select: { id: true, userId: true },
    });
    if (known) {
      await this.prisma.authIdentity.update({
        where: { id: known.id },
        data: { lastSignInAt: now, email: identity.email },
      });
      await this.users.fillMissing(known.userId, this.profile(identity, now));
      return known.userId;
    }

    if (!identity.email) throw new IdentityRejected("email_missing");
    if (!identity.emailVerified) throw new IdentityRejected("email_unverified");

    const existingUserId = await this.users.findIdByEmail(identity.email);
    if (existingUserId) {
      const other = await this.prisma.authIdentity.findFirst({
        where: { userId: existingUserId, provider },
        select: { id: true },
      });
      if (other) throw new IdentityRejected("email_taken");
    }
    const userId =
      existingUserId ??
      (await this.users.create({ email: identity.email, ...this.profile(identity, now) }));
    await this.prisma.authIdentity.create({
      data: {
        userId,
        provider,
        subject: identity.subject,
        email: identity.email,
        createdAt: now,
        lastSignInAt: now,
      },
    });
    if (existingUserId) await this.users.fillMissing(userId, this.profile(identity, now));
    return userId;
  }

  private profile(identity: OidcIdentity, now: Date) {
    return {
      name: identity.name,
      image: identity.picture,
      emailVerified: identity.emailVerified ? now : null,
    };
  }
}
