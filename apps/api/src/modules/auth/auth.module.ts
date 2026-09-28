import { Global, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller.js";
import { GoogleOAuthService } from "./google-oauth.service.js";
import { SessionService } from "./session.service.js";

@Global()
@Module({
  controllers: [AuthController],
  providers: [SessionService, GoogleOAuthService],
  exports: [SessionService],
})
export class AuthModule {}
