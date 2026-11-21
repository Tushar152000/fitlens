import { Injectable } from "@nestjs/common";
import type { StaffInviteInput } from "@fitr8/contracts";
import { blogCan } from "@fitr8/domain/blog";
import { staffCan, type StaffAction, type StaffRole } from "@fitr8/domain/staff";
import { AppError, notFound } from "../../common/errors.js";
import { InjectEnv, type Env } from "../../config/config.module.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { UsersService } from "../users/users.service.js";

/** Who is calling an admin route: their staff row. Set by StaffGuard. */
export interface StaffActor {
  id: string;
  userId: string;
  role: StaffRole;
  name: string;
}

const staffSelect = { id: true, userId: true, email: true, name: true, role: true } as const;
type StaffRow = { id: string; userId: string | null; email: string; name: string; role: StaffRole };

/**
 * The FITR8 staff (staff_members): who may open /admin and with which role. Every admin section
 * (the blog first) authorises against this; sections keep their own data.
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    @InjectEnv() private readonly env: Env,
  ) {}

  /** In ADMIN_EMAILS: always ADMIN, can't be demoted or removed from the UI. */
  isFixedAdmin = (email: string | null | undefined) =>
    Boolean(email && this.env.ADMIN_EMAILS.includes(email.toLowerCase()));

  /**
   * The signed-in user's staff row, or null when they aren't staff. An invite for their email is
   * claimed on first visit; ADMIN_EMAILS are made (and kept) admins.
   */
  async resolve(userId: string): Promise<StaffActor | null> {
    const linked = await this.prisma.staffMember.findUnique({
      where: { userId },
      select: staffSelect,
    });
    if (linked) {
      if (linked.role !== "ADMIN" && this.isFixedAdmin(linked.email)) {
        await this.prisma.staffMember.update({ where: { id: linked.id }, data: { role: "ADMIN" } });
        linked.role = "ADMIN";
      }
      return { id: linked.id, userId, role: linked.role, name: linked.name };
    }

    const user = await this.users.identity(userId);
    const email = user?.email?.toLowerCase();
    if (!email) return null;

    const invite = await this.prisma.staffMember.findUnique({
      where: { email },
      select: staffSelect,
    });
    if (invite) {
      // A row linked to someone else (that account's email changed) is not claimable.
      if (invite.userId && invite.userId !== userId) return null;
      const role = this.isFixedAdmin(email) ? "ADMIN" : invite.role;
      await this.prisma.staffMember.update({ where: { id: invite.id }, data: { userId, role } });
      return { id: invite.id, userId, role, name: invite.name };
    }

    if (!this.isFixedAdmin(email)) return null;
    const name = [user?.name, user?.lastName].filter(Boolean).join(" ") || email.split("@")[0]!;
    const created = await this.prisma.staffMember.create({
      data: { userId, email, name, role: "ADMIN" },
      select: staffSelect,
    });
    return { id: created.id, userId, role: created.role, name: created.name };
  }

  private toDto(m: StaffRow) {
    return {
      id: m.id,
      email: m.email,
      name: m.name,
      role: m.role,
      joined: Boolean(m.userId),
      fixed: this.isFixedAdmin(m.email),
    };
  }

  private async find(id: string) {
    const m = await this.prisma.staffMember.findUnique({ where: { id }, select: staffSelect });
    if (!m) throw notFound("Team member");
    return m;
  }

  /** The caller and what each admin section lets them do (the web builds its menus from this). */
  async me(actor: StaffActor) {
    return {
      staff: this.toDto(await this.find(actor.id)),
      can: { manageTeam: staffCan(actor.role, "manage-team") },
      sections: {
        blog: {
          publish: blogCan(actor.role, "publish"),
          manageContent: blogCan(actor.role, "manage-content"),
          assignAuthor: blogCan(actor.role, "assign-author"),
        },
      },
    };
  }

  /** Everyone on the team (any staff member may see who's on it). */
  async list() {
    const rows = await this.prisma.staffMember.findMany({
      orderBy: [{ role: "asc" }, { name: "asc" }],
      select: staffSelect,
    });
    return rows.map((m) => this.toDto(m));
  }

  /** Name of a staff member, or null if there's no such person (sections use it to validate ids). */
  async nameOf(id: string): Promise<string | null> {
    const m = await this.prisma.staffMember.findUnique({ where: { id }, select: { name: true } });
    return m?.name ?? null;
  }

  async invite(actor: StaffActor, input: StaffInviteInput) {
    this.require(actor, "manage-team");
    if (
      await this.prisma.staffMember.findUnique({
        where: { email: input.email },
        select: { id: true },
      })
    )
      throw new AppError(409, "That email is already on the team");
    const userId = await this.users.findIdByEmail(input.email);
    if (
      userId &&
      (await this.prisma.staffMember.findUnique({ where: { userId }, select: { id: true } }))
    )
      throw new AppError(409, "That person is already on the team");
    const created = await this.prisma.staffMember.create({
      data: {
        email: input.email,
        role: input.role,
        name: input.name || input.email.split("@")[0]!,
        userId,
      },
      select: staffSelect,
    });
    return this.toDto(created);
  }

  async setRole(actor: StaffActor, id: string, role: StaffRole) {
    this.require(actor, "manage-team");
    const m = await this.find(id);
    if (this.isFixedAdmin(m.email) && role !== "ADMIN")
      throw new AppError(409, "This admin is set in ADMIN_EMAILS; remove them there first");
    if (m.id === actor.id && role !== "ADMIN") await this.requireAnotherAdmin(actor.id);
    await this.prisma.staffMember.update({ where: { id }, data: { role } });
    return this.toDto(await this.find(id));
  }

  /** Removes someone from the team. Their work stays (a blog post keeps no author). */
  async remove(actor: StaffActor, id: string) {
    this.require(actor, "manage-team");
    const m = await this.find(id);
    if (this.isFixedAdmin(m.email))
      throw new AppError(409, "This admin is set in ADMIN_EMAILS; remove them there first");
    if (m.id === actor.id) await this.requireAnotherAdmin(actor.id);
    await this.prisma.staffMember.delete({ where: { id } });
  }

  private async requireAnotherAdmin(exceptId: string) {
    const others = await this.prisma.staffMember.count({
      where: { role: "ADMIN", id: { not: exceptId } },
    });
    if (!others) throw new AppError(409, "The team needs at least one other admin first");
  }

  require(actor: StaffActor, action: StaffAction) {
    if (!staffCan(actor.role, action))
      throw new AppError(403, "Your role on the team can't do that");
  }
}
