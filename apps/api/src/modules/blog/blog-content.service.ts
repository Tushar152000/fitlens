import { Injectable } from "@nestjs/common";
import type { Response } from "express";
import type {
  BlogCategoryInput,
  BlogMediaUploadInput,
  BlogRedirectInput,
  BlogTagInput,
} from "@fitr8/contracts";
import { Prisma } from "@fitr8/db";
import { AppError, notFound } from "../../common/errors.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { StorageService } from "../../infra/storage/storage.service.js";
import { BlogUrls, mediaSelect, uniqueSlug, visiblePost } from "./blog-dto.js";
import type { StaffActor } from "../admin/staff.service.js";
import { BlogAuthorsService } from "./blog-authors.service.js";

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";

/** Categories, tags, redirects and the image library. */
@Injectable()
export class BlogContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly authors: BlogAuthorsService,
    private readonly urls: BlogUrls,
  ) {}

  // ── Categories ──────────────────────────────────────────────────────

  async categories(opts: { publicOnly: boolean }) {
    const rows = await this.prisma.blogCategory.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { posts: opts.publicOnly ? { where: visiblePost() } : true } },
      },
    });
    return rows
      .map(({ _count, createdAt: _c, updatedAt: _u, ...c }) => ({ ...c, postCount: _count.posts }))
      .filter((c) => !opts.publicOnly || c.postCount > 0);
  }

  async category(slug: string) {
    const [c] = (await this.categories({ publicOnly: true })).filter((c) => c.slug === slug);
    if (!c) throw notFound("Category");
    return c;
  }

  async saveCategory(actor: StaffActor, input: BlogCategoryInput, id?: string) {
    this.authors.require(actor, "manage-content");
    if (id) await this.findOr404("blogCategory", id, "Category");
    const slug =
      input.slug ??
      (await uniqueSlug(input.name, async (s) =>
        Boolean(await this.prisma.blogCategory.findFirst({ where: { slug: s, id: { not: id } } })),
      ));
    const data = { ...input, slug };
    try {
      const saved = id
        ? await this.prisma.blogCategory.update({ where: { id }, data })
        : await this.prisma.blogCategory.create({ data });
      return (await this.categories({ publicOnly: false })).find((c) => c.id === saved.id)!;
    } catch (err) {
      if (isUniqueViolation(err))
        throw new AppError(409, "A category with that name or URL already exists");
      throw err;
    }
  }

  /** Its posts stay, uncategorised. */
  async deleteCategory(actor: StaffActor, id: string) {
    this.authors.require(actor, "manage-content");
    const { count } = await this.prisma.blogCategory.deleteMany({ where: { id } });
    if (!count) throw notFound("Category");
  }

  // ── Tags ────────────────────────────────────────────────────────────

  async tags(opts: { publicOnly: boolean }) {
    const rows = await this.prisma.blogTag.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { posts: opts.publicOnly ? { where: { post: visiblePost() } } : true },
        },
      },
    });
    return rows
      .map(({ _count, createdAt: _c, ...t }) => ({ ...t, postCount: _count.posts }))
      .filter((t) => !opts.publicOnly || t.postCount > 0);
  }

  async tag(slug: string) {
    const [t] = (await this.tags({ publicOnly: true })).filter((t) => t.slug === slug);
    if (!t) throw notFound("Tag");
    return t;
  }

  async saveTag(actor: StaffActor, input: BlogTagInput, id?: string) {
    this.authors.require(actor, "manage-content");
    if (id) await this.findOr404("blogTag", id, "Tag");
    const slug =
      input.slug ??
      (await uniqueSlug(input.name, async (s) =>
        Boolean(await this.prisma.blogTag.findFirst({ where: { slug: s, id: { not: id } } })),
      ));
    const data = { ...input, slug };
    try {
      const saved = id
        ? await this.prisma.blogTag.update({ where: { id }, data })
        : await this.prisma.blogTag.create({ data });
      return (await this.tags({ publicOnly: false })).find((t) => t.id === saved.id)!;
    } catch (err) {
      if (isUniqueViolation(err))
        throw new AppError(409, "A tag with that name or URL already exists");
      throw err;
    }
  }

  async deleteTag(actor: StaffActor, id: string) {
    this.authors.require(actor, "manage-content");
    const { count } = await this.prisma.blogTag.deleteMany({ where: { id } });
    if (!count) throw notFound("Tag");
  }

  // ── Redirects ───────────────────────────────────────────────────────

  async redirects(actor: StaffActor) {
    this.authors.require(actor, "manage-content");
    return this.prisma.blogRedirect.findMany({ orderBy: { createdAt: "desc" } });
  }

  async addRedirect(actor: StaffActor, input: BlogRedirectInput) {
    this.authors.require(actor, "manage-content");
    if (input.toPath === `/blog/${input.fromSlug}`)
      throw new AppError(400, "A redirect can't point to itself");
    if (
      await this.prisma.blogPost.findUnique({
        where: { slug: input.fromSlug },
        select: { id: true },
      })
    )
      throw new AppError(409, "A post already lives at that URL; change its slug first");
    try {
      return await this.prisma.blogRedirect.create({ data: { ...input, auto: false } });
    } catch (err) {
      if (isUniqueViolation(err)) throw new AppError(409, "That URL already redirects somewhere");
      throw err;
    }
  }

  async deleteRedirect(actor: StaffActor, id: string) {
    this.authors.require(actor, "manage-content");
    const { count } = await this.prisma.blogRedirect.deleteMany({ where: { id } });
    if (!count) throw notFound("Redirect");
  }

  /** Where an old slug moved to, if anywhere. */
  async redirectFor(slug: string): Promise<string | null> {
    const r = await this.prisma.blogRedirect.findUnique({ where: { fromSlug: slug } });
    return r?.toPath ?? null;
  }

  // ── Media ───────────────────────────────────────────────────────────

  /** Registers the image and returns a 5-minute signed URL the browser PUTs the file to. */
  async createUpload(actor: StaffActor, input: BlogMediaUploadInput) {
    const key = this.storage.blogMediaKey(input.contentType);
    const media = await this.prisma.blogMedia.create({
      data: { key, contentType: input.contentType, alt: input.alt, uploadedById: actor.id },
      select: mediaSelect,
    });
    const uploadUrl = await this.storage.presignUpload(key, input.contentType);
    return { media: this.urls.mediaDto(media), uploadUrl };
  }

  async media(actor: StaffActor, page: number) {
    this.authors.require(actor, "write");
    const take = 48;
    const [rows, total] = await Promise.all([
      this.prisma.blogMedia.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * take,
        take,
        select: mediaSelect,
      }),
      this.prisma.blogMedia.count(),
    ]);
    return {
      media: rows.map((m) => this.urls.mediaDto(m)),
      page,
      pages: Math.max(1, Math.ceil(total / take)),
      total,
    };
  }

  async updateMedia(actor: StaffActor, id: string, alt: string | null) {
    await this.ownMediaOr404(actor, id);
    const m = await this.prisma.blogMedia.update({
      where: { id },
      data: { alt },
      select: mediaSelect,
    });
    return this.urls.mediaDto(m);
  }

  /** Deletes the file too. Posts using it as a cover lose the cover; inline copies break. */
  async deleteMedia(actor: StaffActor, id: string) {
    const m = await this.ownMediaOr404(actor, id);
    await this.prisma.blogMedia.delete({ where: { id } });
    await this.storage.deleteObject(m.key).catch(() => undefined);
  }

  /** Authors manage their own uploads; editors and admins everyone's. */
  private async ownMediaOr404(actor: StaffActor, id: string) {
    const m = await this.prisma.blogMedia.findUnique({
      where: { id },
      select: { key: true, uploadedById: true },
    });
    if (!m) throw notFound("Image");
    if (actor.role === "AUTHOR" && m.uploadedById !== actor.id)
      throw new AppError(403, "Only editors can change other people's images");
    return m;
  }

  /** GET /api/blog/media/<file>: streams the image with a year-long cache (file names never repeat). */
  async streamMedia(file: string, res: Response) {
    if (!/^[0-9a-f-]{36}\.(jpg|png|webp|gif|avif)$/.test(file)) throw notFound("Image");
    const key = `blog/${file}`;
    const known = await this.prisma.blogMedia.findUnique({
      where: { key },
      select: { contentType: true },
    });
    if (!known) throw notFound("Image");
    const obj = await this.storage.getObject(key);
    if (!obj) throw notFound("Image");
    res.setHeader("Content-Type", known.contentType);
    if (obj.contentLength) res.setHeader("Content-Length", String(obj.contentLength));
    if (obj.etag) res.setHeader("ETag", obj.etag);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    // helmet sets same-origin; the images are shown on www.fitr8.com and in social previews.
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    await new Promise<void>((resolve, reject) => {
      obj.body.on("error", reject);
      res.on("finish", resolve);
      res.on("close", resolve);
      obj.body.pipe(res);
    });
  }

  private async findOr404(model: "blogCategory" | "blogTag", id: string, what: string) {
    const found =
      model === "blogCategory"
        ? await this.prisma.blogCategory.findUnique({ where: { id }, select: { id: true } })
        : await this.prisma.blogTag.findUnique({ where: { id }, select: { id: true } });
    if (!found) throw notFound(what);
  }
}
