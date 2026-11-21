import {
  createParamDecorator,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import type { AuthedRequest } from "../../common/auth/decorators.js";
import { AppError } from "../../common/errors.js";
import { StaffService, type StaffActor } from "./staff.service.js";

interface StaffRequest extends AuthedRequest {
  staff: StaffActor;
}

/**
 * Every /admin/* route (all sections): runs after the global AuthGuard (so the caller is signed in)
 * and lets through only staff. Everyone else gets 403, with the message the "no access" page shows.
 */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(private readonly staff: StaffService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<StaffRequest>();
    const actor = await this.staff.resolve(req.auth.userId);
    if (!actor)
      throw new AppError(403, "This account isn't on the FITR8 team. Ask an admin to invite you.");
    req.staff = actor;
    return true;
  }
}

/** The calling staff member: `@Staff() actor: StaffActor`. Only on routes behind StaffGuard. */
export const Staff = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<StaffRequest>().staff,
);
