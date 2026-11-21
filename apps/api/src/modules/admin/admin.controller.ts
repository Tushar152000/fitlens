import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import {
  StaffInviteSchema,
  StaffUpdateSchema,
  type AdminMeDto,
  type StaffInviteInput,
  type StaffMemberDto,
  type StaffUpdateInput,
} from "@fitr8/contracts";
import { NoStoreInterceptor } from "../../common/http/no-store.interceptor.js";
import { ZodBody } from "../../common/http/zod.js";
import { Staff, StaffGuard } from "./staff.guard.js";
import { StaffService, type StaffActor } from "./staff.service.js";

/** The admin itself: who is signed in, and the team. Sections add their own `admin/<section>` routes. */
@Controller("admin")
@UseGuards(StaffGuard)
@UseInterceptors(NoStoreInterceptor)
export class AdminController {
  constructor(private readonly staff: StaffService) {}

  @Get("me")
  me(@Staff() actor: StaffActor): Promise<AdminMeDto> {
    return this.staff.me(actor);
  }

  @Get("staff")
  list(): Promise<StaffMemberDto[]> {
    return this.staff.list();
  }

  @Post("staff")
  invite(
    @Staff() actor: StaffActor,
    @ZodBody(StaffInviteSchema) input: StaffInviteInput,
  ): Promise<StaffMemberDto> {
    return this.staff.invite(actor, input);
  }

  @Patch("staff/:id")
  setRole(
    @Staff() actor: StaffActor,
    @Param("id") id: string,
    @ZodBody(StaffUpdateSchema) { role }: StaffUpdateInput,
  ): Promise<StaffMemberDto> {
    return this.staff.setRole(actor, id, role);
  }

  @Delete("staff/:id")
  @HttpCode(204)
  async remove(@Staff() actor: StaffActor, @Param("id") id: string) {
    await this.staff.remove(actor, id);
  }
}
