import { Injectable } from "@nestjs/common";
import {
  BLOG_ADMIN_PAGE_SIZE,
  BLOG_PAGE_SIZE,
  type BlogAdminPostQuery,
  type BlogPostCreateInput,
  type BlogPostListQuery,
  type BlogPostUpdateInput,
} from "@fitr8/contracts";
import { Prisma } from "@fitr8/db";
import {
  blogCan,
  effectiveStatus,
  isReservedPostSlug,
  type StoredPostStatus,
} from "@fitr8/domain/blog";
import { AppError, notFound } from "../../common/errors.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { renderPostHtml, rssFeed } from "./blog-html.js";
import {
  asDoc,
  asFaq,
  asToc,
  BlogUrls,
  mediaSelect,
  rowSelect,
  summarySelect,
  toRow,
  toSummary,
  uniqueSlug,
  visiblePost,
} from "./blog-dto.js";
import type { StaffActor } from "../admin/staff.service.js";
import { BlogAuthorsService } from "./blog-authors.service.js";

/** A new revision while editing at most this often; publish, restore and "Save version" always take one. */
export const REVISION_EVERY_MS = 10 * 60_000;
export const REVISIONS_KEPT = 50;

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

const adminSelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  contentJson: true,
  contentHtml: true,
  contentText: true,
  toc: true,
  wordCount: true,
  readingMinutes: true,
  status: true,
  publishedAt: true,
  featured: true,
  coverAlt: true,
  authorId: true,
  categoryId: true,
  metaTitle: true,
  metaDescription: true,
  canonicalUrl: true,
  noindex: true,
  focusKeyword: true,
  faq: true,
  createdAt: true,
  updatedAt: true,
  cover: { select: mediaSelect },
  ogImage: { select: mediaSelect },
  tags: { select: { tagId: true } },
} as const satisfies Prisma.BlogPostSelect;
type AdminRow = Prisma.BlogPostGetPayload<{ select: typeof adminSelect }>;

/** Posts: the editor's reads and writes, revisions, and what readers see. */
@Injectable()
export class BlogPostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authors: BlogAuthorsService,
    private readonly urls: BlogUrls,
  ) {}

  // ── Permissions ─────────────────────────────────────────────────────

  private perms(
    actor: StaffActor,
    p: { authorId: string | null; status: StoredPostStatus; publishedAt: Date | null },
  ) {
    const ctx = { own: p.authorId === actor.id, published: p.status !== "DRAFT" };
    return {
      edit: blogCan(actor.role, "edit-post", ctx),
      publish: blogCan(actor.role, "publish"),
      delete: blogCan(actor.role, "delete-post", ctx),
    };
  }

  /** The post, if the caller may see it in the admin: authors see only their own (others → 404). */
  private async load(actor: StaffActor, id: string): Promise<AdminRow> {
    const post = await this.prisma.blogPost.findUnique({ where: { id }, select: adminSelect });
    if (!post || (actor.role === "AUTHOR" && post.authorId !== actor.id)) throw notFound("Post");
    return post;
  }

  private toAdmin(actor: StaffActor, p: AdminRow) {
    const { tags, cover, ogImage, contentJson, toc, faq, ...rest } = p;
    return {
      ...rest,
      status: effectiveStatus(p.status, p.publishedAt),
      contentJson: asDoc(contentJson),
      toc: asToc(toc),
      faq: asFaq(faq),
      cover: this.urls.mediaOrNull(cover),
      ogImage: this.urls.mediaOrNull(ogImage),
      tagIds: tags.map((t) => t.tagId),
      can: this.perms(actor, p),
    };
  }

  private slugTaken = async (slug: string, exceptId?: string) =>
    isReservedPostSlug(slug) ||
    Boolean(
      await this.prisma.blogPost.findFirst({
        where: { slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
        select: { id: true },
      }),
    );

  // ── Admin ───────────────────────────────────────────────────────────

  async stats(actor: StaffActor) {
    const mine: Prisma.BlogPostWhereInput = actor.role === "AUTHOR" ? { authorId: actor.id } : {};
    const now = new Date();
    const [counts, categories, tags, media, recent, upcoming] = await Promise.all([
      this.statusCounts(mine, now),
      this.prisma.blogCategory.count(),
      this.prisma.blogTag.count(),
      this.prisma.blogMedia.count(),
      this.prisma.blogPost.findMany({
        where: mine,
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: rowSelect,
      }),
      this.prisma.blogPost.findMany({
        where: { ...mine, status: "SCHEDULED", publishedAt: { gt: now } },
        orderBy: { publishedAt: "asc" },
        take: 5,
        select: rowSelect,
      }),
    ]);
    return {
      counts: { ...counts, categories, tags, media },
      recent: recent.map((r) => toRow(r, now)),
      upcoming: upcoming.map((r) => toRow(r, now)),
    };
  }

  /** Counts by what readers see (a scheduled post whose time passed counts as published). */
  private async statusCounts(where: Prisma.BlogPostWhereInput, now: Date) {
    const [draft, scheduled, published] = await Promise.all([
      this.prisma.blogPost.count({ where: { ...where, status: "DRAFT" } }),
      this.prisma.blogPost.count({
        where: { ...where, status: "SCHEDULED", publishedAt: { gt: now } },
      }),
      this.prisma.blogPost.count({ where: { AND: [where, visiblePost(now)] } }),
    ]);
    return { DRAFT: draft, SCHEDULED: scheduled, PUBLISHED: published };
  }

  async list(actor: StaffActor, q: BlogAdminPostQuery) {
    const now = new Date();
    const scope: Prisma.BlogPostWhereInput =
      actor.role === "AUTHOR" || q.mine === "1" ? { authorId: actor.id } : {};
    const search: Prisma.BlogPostWhereInput = q.q
      ? {
          OR: [
            { title: { contains: q.q, mode: "insensitive" } },
            { slug: { contains: q.q, mode: "insensitive" } },
          ],
        }
      : {};
    const byStatus: Prisma.BlogPostWhereInput =
      q.status === "PUBLISHED"
        ? visiblePost(now)
        : q.status === "SCHEDULED"
          ? { status: "SCHEDULED", publishedAt: { gt: now } }
          : q.status === "DRAFT"
            ? { status: "DRAFT" }
            : {};
    const where: Prisma.BlogPostWhereInput = { AND: [scope, search, byStatus] };
    const [rows, total, counts] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (q.page - 1) * BLOG_ADMIN_PAGE_SIZE,
        take: BLOG_ADMIN_PAGE_SIZE,
        select: rowSelect,
      }),
      this.prisma.blogPost.count({ where }),
      this.statusCounts({ AND: [scope, search] }, now),
    ]);
    return {
      posts: rows.map((r) => toRow(r, now)),
      page: q.page,
      pages: Math.max(1, Math.ceil(total / BLOG_ADMIN_PAGE_SIZE)),
      total,
      counts,
    };
  }

  async create(actor: StaffActor, input: BlogPostCreateInput) {
    this.authors.require(actor, "write");
    await this.authors.ensure(actor.id);
    const title = input.title?.trim() || "Untitled post";
    const slug = await uniqueSlug(title, (s) => this.slugTaken(s));
    const post = await this.prisma.blogPost.create({
      data: {
        title,
        slug,
        contentJson: EMPTY_DOC,
        contentHtml: "",
        contentText: "",
        authorId: actor.id,
      },
      select: adminSelect,
    });
    return this.toAdmin(actor, post);
  }

  async get(actor: StaffActor, id: string) {
    return this.toAdmin(actor, await this.load(actor, id));
  }

  async update(actor: StaffActor, id: string, input: BlogPostUpdateInput) {
    const post = await this.load(actor, id);
    if (!this.perms(actor, post).edit)
      throw new AppError(403, "Only editors can change a published or scheduled post");
    if (input.baseUpdatedAt && new Date(input.baseUpdatedAt).getTime() !== post.updatedAt.getTime())
      throw new AppError(
        409,
        "Someone saved this post after you opened it. Reload to get their changes.",
        { updatedAt: post.updatedAt.toISOString() },
      );

    const {
      baseUpdatedAt: _b,
      snapshot,
      tagIds,
      contentJson,
      contentHtml,
      authorId,
      ...fields
    } = input;
    const data: Prisma.BlogPostUncheckedUpdateInput = { ...fields };

    if (input.slug && isReservedPostSlug(input.slug))
      throw new AppError(
        400,
        `"${input.slug}" is reserved for the blog's own pages; pick another URL`,
      );
    if (input.slug && input.slug !== post.slug && (await this.slugTaken(input.slug, id)))
      throw new AppError(409, "Another post already uses that URL");
    if (authorId !== undefined && authorId !== post.authorId) {
      if (!blogCan(actor.role, "assign-author"))
        throw new AppError(403, "Only editors can change a post's author");
      // Any staff member can be the author; their author profile is made on first use (400 if unknown).
      await this.authors.ensure(authorId);
      data.authorId = authorId;
    }
    if (input.categoryId) {
      const c = await this.prisma.blogCategory.findUnique({
        where: { id: input.categoryId },
        select: { id: true },
      });
      if (!c) throw new AppError(400, "That category no longer exists");
    }
    if (tagIds?.length) {
      const found = await this.prisma.blogTag.count({ where: { id: { in: tagIds } } });
      if (found !== new Set(tagIds).size)
        throw new AppError(400, "One of those tags no longer exists");
    }
    for (const mediaId of [input.coverId, input.ogImageId])
      if (mediaId) await this.authors.requireMedia(mediaId);
    if (
      input.featured !== undefined &&
      !blogCan(actor.role, "publish") &&
      input.featured !== post.featured
    )
      throw new AppError(403, "Only editors can feature a post");

    if (contentHtml !== undefined && contentJson !== undefined) {
      const r = renderPostHtml(contentHtml);
      Object.assign(data, {
        contentJson: contentJson as Prisma.InputJsonValue,
        contentHtml: r.html,
        contentText: r.text,
        toc: r.toc as unknown as Prisma.InputJsonValue,
        wordCount: r.words,
        readingMinutes: r.minutes,
      });
    }
    if (input.faq) data.faq = input.faq as unknown as Prisma.InputJsonValue;

    const live = effectiveStatus(post.status, post.publishedAt) !== "DRAFT";
    const slugMoved = input.slug !== undefined && input.slug !== post.slug;
    const contentChanged =
      (data.contentHtml !== undefined && data.contentHtml !== post.contentHtml) ||
      (input.title !== undefined && input.title !== post.title);
    const takeRevision = contentChanged && (snapshot || (await this.revisionDue(id)));

    const saved = await this.prisma.$transaction(async (tx) => {
      if (takeRevision) await this.snapshot(tx, post, actor, snapshot ? "manual" : "autosave");
      if (slugMoved) {
        // A real post now lives here: an old redirect from this slug would shadow it.
        await tx.blogRedirect.deleteMany({ where: { fromSlug: input.slug } });
        if (live) {
          // Readers and Google may have the old URL. Point it (and anything pointing at it) to the new one.
          const to = `/blog/${input.slug}`;
          await tx.blogRedirect.updateMany({
            where: { toPath: `/blog/${post.slug}` },
            data: { toPath: to },
          });
          await tx.blogRedirect.upsert({
            where: { fromSlug: post.slug },
            create: { fromSlug: post.slug, toPath: to, auto: true },
            update: { toPath: to, auto: true },
          });
        }
      }
      if (tagIds) {
        await tx.blogPostTag.deleteMany({ where: { postId: id } });
        if (tagIds.length)
          await tx.blogPostTag.createMany({
            data: [...new Set(tagIds)].map((tagId) => ({ postId: id, tagId })),
          });
      }
      return tx.blogPost.update({ where: { id }, data, select: adminSelect });
    });
    if (takeRevision) await this.pruneRevisions(id);
    return this.toAdmin(actor, saved);
  }

  async publish(actor: StaffActor, id: string, publishAt?: string) {
    const post = await this.load(actor, id);
    if (!blogCan(actor.role, "publish")) throw new AppError(403, "Only editors can publish");
    if (!post.title.trim() || !post.contentText.trim())
      throw new AppError(400, "Add a title and some words before publishing");
    const now = new Date();
    const at = publishAt ? new Date(publishAt) : null;
    const scheduled = at && at > now;
    const publishedAt = scheduled
      ? at
      : (at ?? (post.publishedAt && post.publishedAt <= now ? post.publishedAt : now));
    const saved = await this.prisma.$transaction(async (tx) => {
      await this.snapshot(tx, post, actor, scheduled ? "schedule" : "publish");
      return tx.blogPost.update({
        where: { id },
        data: { status: scheduled ? "SCHEDULED" : "PUBLISHED", publishedAt },
        select: adminSelect,
      });
    });
    await this.pruneRevisions(id);
    return this.toAdmin(actor, saved);
  }

  async unpublish(actor: StaffActor, id: string) {
    await this.load(actor, id);
    if (!blogCan(actor.role, "publish")) throw new AppError(403, "Only editors can unpublish");
    const saved = await this.prisma.blogPost.update({
      where: { id },
      data: { status: "DRAFT" },
      select: adminSelect,
    });
    return this.toAdmin(actor, saved);
  }

  async remove(actor: StaffActor, id: string) {
    const post = await this.load(actor, id);
    if (!this.perms(actor, post).delete)
      throw new AppError(403, "Only editors can delete a live post");
    await this.prisma.blogPost.delete({ where: { id } });
  }

  // ── Revisions ───────────────────────────────────────────────────────

  private async revisionDue(postId: string) {
    const last = await this.prisma.blogRevision.findFirst({
      where: { postId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    return !last || Date.now() - last.createdAt.getTime() >= REVISION_EVERY_MS;
  }

  private snapshot(
    tx: Prisma.TransactionClient,
    post: Pick<AdminRow, "id" | "title" | "excerpt" | "contentJson" | "contentHtml">,
    actor: StaffActor,
    reason: string,
  ) {
    return tx.blogRevision.create({
      data: {
        postId: post.id,
        title: post.title,
        excerpt: post.excerpt,
        contentJson: post.contentJson as Prisma.InputJsonValue,
        contentHtml: post.contentHtml,
        reason,
        staffId: actor.id,
      },
    });
  }

  private async pruneRevisions(postId: string) {
    const keep = await this.prisma.blogRevision.findMany({
      where: { postId },
      orderBy: { createdAt: "desc" },
      take: REVISIONS_KEPT,
      select: { id: true },
    });
    await this.prisma.blogRevision.deleteMany({
      where: { postId, id: { notIn: keep.map((k) => k.id) } },
    });
  }

  async revisions(actor: StaffActor, id: string) {
    await this.load(actor, id);
    const rows = await this.prisma.blogRevision.findMany({
      where: { postId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        reason: true,
        createdAt: true,
        staff: { select: { id: true, name: true } },
      },
    });
    return rows.map(({ staff, ...r }) => ({ ...r, member: staff }));
  }

  async revision(actor: StaffActor, id: string, revisionId: string) {
    await this.load(actor, id);
    const r = await this.prisma.blogRevision.findFirst({
      where: { id: revisionId, postId: id },
      select: {
        id: true,
        title: true,
        excerpt: true,
        contentHtml: true,
        reason: true,
        createdAt: true,
        staff: { select: { id: true, name: true } },
      },
    });
    if (!r) throw notFound("Revision");
    const { staff, ...rest } = r;
    return { ...rest, member: staff };
  }

  /** Puts an old version back. The current words are saved as a revision first, so nothing is lost. */
  async restore(actor: StaffActor, id: string, revisionId: string) {
    const post = await this.load(actor, id);
    if (!this.perms(actor, post).edit)
      throw new AppError(403, "Only editors can change a published or scheduled post");
    const r = await this.prisma.blogRevision.findFirst({ where: { id: revisionId, postId: id } });
    if (!r) throw notFound("Revision");
    const rendered = renderPostHtml(r.contentHtml);
    const saved = await this.prisma.$transaction(async (tx) => {
      await this.snapshot(tx, post, actor, "before restore");
      return tx.blogPost.update({
        where: { id },
        data: {
          title: r.title,
          excerpt: r.excerpt,
          contentJson: r.contentJson as Prisma.InputJsonValue,
          contentHtml: rendered.html,
          contentText: rendered.text,
          toc: rendered.toc as unknown as Prisma.InputJsonValue,
          wordCount: rendered.words,
          readingMinutes: rendered.minutes,
        },
        select: adminSelect,
      });
    });
    await this.pruneRevisions(id);
    return this.toAdmin(actor, saved);
  }

  // ── Public ──────────────────────────────────────────────────────────

  async publicList(q: BlogPostListQuery) {
    const now = new Date();
    const filters: Prisma.BlogPostWhereInput[] = [visiblePost(now)];
    if (q.category) filters.push({ category: { slug: q.category } });
    if (q.tag) filters.push({ tags: { some: { tag: { slug: q.tag } } } });
    if (q.author) filters.push({ author: { slug: q.author } });
    if (q.q)
      filters.push({
        OR: [
          { title: { contains: q.q, mode: "insensitive" } },
          { excerpt: { contains: q.q, mode: "insensitive" } },
          { contentText: { contains: q.q, mode: "insensitive" } },
        ],
      });
    const where = { AND: filters };
    const [rows, total] = await Promise.all([
      this.prisma.blogPost.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        skip: (q.page - 1) * BLOG_PAGE_SIZE,
        take: BLOG_PAGE_SIZE,
        select: summarySelect,
      }),
      this.prisma.blogPost.count({ where }),
    ]);
    return {
      posts: rows.map((r) => toSummary(this.urls, r)),
      page: q.page,
      pages: Math.max(1, Math.ceil(total / BLOG_PAGE_SIZE)),
      total,
    };
  }

  /** A live post by slug; `null` when there is none (the controller then checks redirects). */
  async publicPost(slug: string) {
    const now = new Date();
    const post = await this.prisma.blogPost.findFirst({
      where: { AND: [{ slug }, visiblePost(now)] },
      select: {
        ...summarySelect,
        contentHtml: true,
        toc: true,
        faq: true,
        wordCount: true,
        metaTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        noindex: true,
        categoryId: true,
        ogImage: { select: { key: true } },
        author: {
          select: {
            staffId: true,
            slug: true,
            name: true,
            bio: true,
            website: true,
            twitter: true,
            linkedin: true,
            avatar: { select: { key: true } },
          },
        },
      },
    });
    if (!post) return null;

    const tagSlugs = post.tags.map((t) => t.tag.slug);
    const related = await this.prisma.blogPost.findMany({
      where: {
        AND: [
          visiblePost(now),
          { id: { not: post.id } },
          {
            OR: [
              ...(post.categoryId ? [{ categoryId: post.categoryId }] : []),
              ...(tagSlugs.length ? [{ tags: { some: { tag: { slug: { in: tagSlugs } } } } }] : []),
            ],
          },
        ],
      },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: summarySelect,
    });
    if (related.length < 3) {
      const more = await this.prisma.blogPost.findMany({
        where: {
          AND: [visiblePost(now), { id: { notIn: [post.id, ...related.map((r) => r.id)] } }],
        },
        orderBy: { publishedAt: "desc" },
        take: 3 - related.length,
        select: summarySelect,
      });
      related.push(...more);
    }

    const { ogImage, toc, faq, categoryId: _c, ...rest } = post;
    return {
      ...toSummary(this.urls, post),
      contentHtml: rest.contentHtml,
      wordCount: rest.wordCount,
      metaTitle: rest.metaTitle,
      metaDescription: rest.metaDescription,
      canonicalUrl: rest.canonicalUrl,
      noindex: rest.noindex,
      toc: asToc(toc),
      faq: asFaq(faq),
      ogImageUrl: ogImage ? this.urls.media(ogImage.key) : null,
      authorProfile: post.author ? this.authors.publicAuthorDto(post.author) : null,
      related: related.map((r) => toSummary(this.urls, r)),
    };
  }

  async sitemap() {
    const visible = visiblePost();
    const [posts, categories, tags, authors] = await Promise.all([
      this.prisma.blogPost.findMany({
        where: { AND: [visible, { noindex: false }] },
        orderBy: { publishedAt: "desc" },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.blogCategory.findMany({
        where: { posts: { some: visible } },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.blogTag.findMany({
        where: { posts: { some: { post: visible } } },
        select: { slug: true },
      }),
      this.prisma.blogAuthor.findMany({
        where: { posts: { some: visible } },
        select: { slug: true },
      }),
    ]);
    return { posts, categories, tags, authors };
  }

  async rss(apiSelfUrl: string) {
    const posts = await this.prisma.blogPost.findMany({
      where: { AND: [visiblePost(), { noindex: false }] },
      orderBy: { publishedAt: "desc" },
      take: 30,
      select: {
        slug: true,
        title: true,
        excerpt: true,
        metaDescription: true,
        publishedAt: true,
        author: { select: { name: true } },
        category: { select: { name: true } },
        tags: { select: { tag: { select: { name: true } } } },
      },
    });
    return rssFeed(
      {
        title: "FITR8 Blog",
        link: this.urls.site("/blog"),
        description: "Food, training and fat-loss guides from the FITR8 team.",
        self: apiSelfUrl,
      },
      posts.map((p) => ({
        title: p.title,
        url: this.urls.site(`/blog/${p.slug}`),
        description: p.metaDescription ?? p.excerpt ?? "",
        publishedAt: p.publishedAt ?? new Date(),
        author: p.author?.name,
        categories: [p.category?.name, ...p.tags.map((t) => t.tag.name)].filter((c): c is string =>
          Boolean(c),
        ),
      })),
    );
  }
}
