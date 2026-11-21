import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller.js";
import { StaffGuard } from "./staff.guard.js";
import { StaffService } from "./staff.service.js";

/**
 * The FITR8 admin (docs/ADMIN.md): staff, roles and the guard every admin section uses. Owns
 * staff_members. A section (e.g. blog) imports this module and puts `@UseGuards(StaffGuard)` on its
 * `admin/<section>` controller.
 */
@Module({
  controllers: [AdminController],
  providers: [StaffService, StaffGuard],
  exports: [StaffService, StaffGuard],
})
export class AdminModule {}
