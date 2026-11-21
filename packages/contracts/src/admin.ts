/**
 * The FITR8 admin (/admin): staff, roles and what each section lets the caller do.
 * Sections (the blog first) have their own contracts; roles come from @fitr8/domain/staff.
 */
import { z } from "zod";
import { STAFF_ROLES, type StaffRole } from "@fitr8/domain/staff";

export const StaffInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter an email address").max(200),
  role: z.enum(STAFF_ROLES),
  name: z.string().trim().max(80).optional(),
});
export type StaffInviteInput = z.infer<typeof StaffInviteSchema>;

export const StaffUpdateSchema = z.object({ role: z.enum(STAFF_ROLES) });
export type StaffUpdateInput = z.infer<typeof StaffUpdateSchema>;

export interface StaffMemberDto {
  id: string;
  email: string;
  name: string;
  role: StaffRole;
  /** false until the invited person signs in for the first time. */
  joined: boolean;
  /** Set in ADMIN_EMAILS: always an admin, can't be demoted or removed from the admin UI. */
  fixed: boolean;
}

/** GET /api/admin/me: who is signed in to the admin, and what each section lets them do. */
export interface AdminMeDto {
  staff: StaffMemberDto;
  can: { manageTeam: boolean };
  sections: {
    blog: { publish: boolean; manageContent: boolean; assignAuthor: boolean };
  };
}
