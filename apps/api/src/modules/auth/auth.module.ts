import { Global, Module } from "@nestjs/common";
import { ENV, type Env } from "../../config/config.module.js";
import { AuthCleanupService } from "./auth-cleanup.service.js";
import { AuthCookies } from "./auth.cookies.js";
import { AuthEventsService } from "./auth-events.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthGuard } from "./auth.guard.js";
import { AuthService } from "./auth.service.js";
import { GoogleOidcClient } from "./google/google-oidc.client.js";
import { GOOGLE_OIDC } from "./google/oidc.js";
import { IdentityService } from "./identity.service.js";
import { OriginGuard } from "./origin.guard.js";
import { SessionService } from "./session.service.js";
import { SessionsController } from "./sessions.controller.js";

/**
 * Identity and sessions (docs/ARCHITECTURE.md §3.6). Owns auth_identities, sessions, auth_codes and
 * auth_events; creates users only through UsersService. Exports the two guards the app registers
 * globally and SessionService, the single place a token becomes a user.
 */
@Global()
@Module({
  controllers: [AuthController, SessionsController],
  providers: [
    AuthService,
    SessionService,
    IdentityService,
    AuthEventsService,
    AuthCookies,
    AuthGuard,
    OriginGuard,
    AuthCleanupService,
    {
      provide: GOOGLE_OIDC,
      inject: [ENV],
      useFactory: (env: Env) =>
        new GoogleOidcClient({
          clientId: env.AUTH_GOOGLE_ID,
          clientSecret: env.AUTH_GOOGLE_SECRET,
        }),
    },
  ],
  exports: [SessionService, AuthGuard, OriginGuard, AuthCookies],
})
export class AuthModule {}
