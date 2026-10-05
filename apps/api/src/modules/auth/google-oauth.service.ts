import { Injectable } from "@nestjs/common";
import { AppError } from "../../common/errors.js";
import { InjectEnv, type Env } from "../../config/config.module.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

interface GoogleIdentity {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/** Google sign-in (OpenID Connect authorization-code flow) that maps a Google identity to a FITR8 user. */
@Injectable()
export class GoogleOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectEnv() private readonly env: Env,
  ) {}

  get enabled(): boolean {
    return Boolean(this.env.AUTH_GOOGLE_ID && this.env.AUTH_GOOGLE_SECRET);
  }

  /** Unchanged from the Auth.js days, so the Google Cloud console config keeps working. */
  get redirectUri(): string {
    return new URL("/api/auth/callback/google", this.env.PUBLIC_URL).href;
  }

  authorizeUrl(state: string): string {
    if (!this.enabled) throw new AppError(503, "Google sign-in is not configured");
    const url = new URL(AUTHORIZE_URL);
    url.search = new URLSearchParams({
      client_id: this.env.AUTH_GOOGLE_ID!,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    }).toString();
    return url.href;
  }

  /** Exchange the code, then find or create the user. Returns the user id. */
  async signIn(code: string): Promise<string> {
    const identity = await this.exchange(code);
    return this.upsertUser(identity);
  }

  private async exchange(code: string): Promise<GoogleIdentity> {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.env.AUTH_GOOGLE_ID!,
        client_secret: this.env.AUTH_GOOGLE_SECRET!,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new AppError(401, "Google sign-in failed");
    const tokens = (await res.json()) as { id_token?: string };
    const payload = tokens.id_token?.split(".")[1];
    if (!payload) throw new AppError(401, "Google sign-in failed");
    // The id_token came straight from Google's token endpoint over TLS, so its claims are trusted
    // without re-verifying the signature (OIDC Core §3.1.3.7).
    return JSON.parse(Buffer.from(payload, "base64url").toString()) as GoogleIdentity;
  }

  private async upsertUser(g: GoogleIdentity): Promise<string> {
    const account = await this.prisma.account.findUnique({
      where: { provider_providerAccountId: { provider: "google", providerAccountId: g.sub } },
      select: { userId: true },
    });
    if (account) return account.userId;

    const email = g.email?.toLowerCase();
    // Link to an existing user only when Google vouches for the address.
    const existing = email ? await this.prisma.user.findUnique({ where: { email } }) : null;
    if (existing && !g.email_verified) {
      throw new AppError(409, "This email already has an account. Sign in the way you did before.");
    }
    const user =
      existing ??
      (await this.prisma.user.create({
        data: {
          email: email ?? null,
          name: g.name ?? null,
          image: g.picture ?? null,
          emailVerified: g.email_verified ? new Date() : null,
        },
      }));
    await this.prisma.account.create({
      data: { userId: user.id, type: "oidc", provider: "google", providerAccountId: g.sub },
    });
    return user.id;
  }
}
