import { Injectable } from "@nestjs/common";
import type { BlogProfileInput } from "@fitr8/contracts";
import { blogCan, type BlogAction } from "@fitr8/domain/blog";
import { AppError, notFound } from "../../common/errors.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { StaffService, type StaffActor } from "../admin/staff.service.js";
import { BlogUrls, mediaSelect, uniqueSlug, visiblePost } from "./blog-dto.js";

const authorSelect = {
  staffId: true,
  slug: true,
  name: true,
  bio: true,
  website: true,
  twitter: true,
  linkedin: true,
  avatar: { select: mediaSelect },
} as const;

/**
 * Blog authors (blog_authors): the public profile of a staff member who writes. Made on first use
 * from the staff name. Roles and the team itself belong to the admin module (StaffService).
 */
@Injectable()
export class BlogAuthorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staff: StaffService,
    private readonly urls: BlogUrls,
  ) {}

  /** 403 unless the caller's staff role allows this blog action. */
  require(actor: StaffActor, action: BlogAction) {
    if (!blogCan(actor.role, action))
      throw new AppError(403, "Your role on the team can't do that on the blog");
  }

  private slugTaken = async (slug: string, exceptStaffId?: string) =>
    Boolean(
      await this.prisma.blogAuthor.findFirst({
        where: { slug, ...(exceptStaffId ? { staffId: { not: exceptStaffId } } : {}) },
        select: { staffId: true },
      }),
    );

  /** The staff member's author row, created from their staff name the first time. 400 if no such staff. */
  async ensure(staffId: string): Promise<void> {
    if (await this.prisma.blogAuthor.findUnique({ where: { staffId }, select: { staffId: true } }))
      return;
    const name = await this.staff.nameOf(staffId);
    if (!name) throw new AppError(400, "That author isn't on the team");
    const slug = await uniqueSlug(name, (s) => this.slugTaken(s), "author");
    await this.prisma.blogAuthor.upsert({
      where: { staffId },
      create: { staffId, name, slug },
      update: {},
    });
  }

  async profile(actor: StaffActor) {
    this.require(actor, "write");
    await this.ensure(actor.id);
    const a = await this.prisma.blogAuthor.findUniqueOrThrow({
      where: { staffId: actor.id },
      select: authorSelect,
    });
    const postCount = await this.prisma.blogPost.count({ where: { authorId: actor.id } });
    return { ...a, avatar: this.urls.mediaOrNull(a.avatar), postCount };
  }

  async updateProfile(actor: StaffActor, input: BlogProfileInput) {
    this.require(actor, "write");
    await this.ensure(actor.id);
    if (await this.slugTaken(input.slug, actor.id))
      throw new AppError(409, "Another author already uses that profile URL");
    if (input.avatarId) await this.requireMedia(input.avatarId);
    await this.prisma.blogAuthor.update({ where: { staffId: actor.id }, data: input });
    return this.profile(actor);
  }

  /** Everyone a post can be assigned to: the whole team. */
  async options() {
    return (await this.staff.list()).map((s) => ({ staffId: s.id, name: s.name, role: s.role }));
  }

  async requireMedia(id: string) {
    const media = await this.prisma.blogMedia.findUnique({ where: { id }, select: { id: true } });
    if (!media) throw new AppError(400, "That image no longer exists");
  }

  // ── Public ──────────────────────────────────────────────────────────

  /** An author's public profile, if they have at least one live post. */
  async publicAuthor(slug: string) {
    const a = await this.prisma.blogAuthor.findFirst({
      where: { slug, posts: { some: visiblePost() } },
      select: authorSelect,
    });
    if (!a) throw notFound("Author");
    return this.publicAuthorDto(a);
  }

  publicAuthorDto(a: {
    staffId: string;
    slug: string;
    name: string;
    bio: string | null;
    website: string | null;
    twitter: string | null;
    linkedin: string | null;
    avatar: { key: string } | null;
  }) {
    return {
      id: a.staffId,
      slug: a.slug,
      name: a.name,
      bio: a.bio,
      avatarUrl: a.avatar ? this.urls.media(a.avatar.key) : null,
      website: a.website,
      twitter: a.twitter,
      linkedin: a.linkedin,
    };
  }
}
