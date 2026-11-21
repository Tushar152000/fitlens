import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { z } from "zod";
import {
  BlogAdminPostQuerySchema,
  BlogCategoryInputSchema,
  BlogMediaUpdateSchema,
  BlogMediaUploadSchema,
  BlogPostCreateSchema,
  BlogPostUpdateSchema,
  BlogProfileSchema,
  BlogPublishSchema,
  BlogRedirectInputSchema,
  BlogTagInputSchema,
  type BlogAdminPostDto,
  type BlogAdminPostPageDto,
  type BlogAdminPostQuery,
  type BlogCategoryDto,
  type BlogCategoryInput,
  type BlogMediaDto,
  type BlogMediaUpdateInput,
  type BlogMediaUploadInput,
  type BlogAuthorOptionDto,
  type BlogAuthorProfileDto,
  type BlogPostCreateInput,
  type BlogPostUpdateInput,
  type BlogProfileInput,
  type BlogPublishInput,
  type BlogRedirectDto,
  type BlogRedirectInput,
  type BlogRevisionDetailDto,
  type BlogRevisionDto,
  type BlogStatsDto,
  type BlogTagDto,
  type BlogTagInput,
} from "@fitr8/contracts";
import { NoStoreInterceptor } from "../../common/http/no-store.interceptor.js";
import { ZodBody, ZodPipe } from "../../common/http/zod.js";
import { wire } from "../../common/http/wire.js";
import { BlogContentService } from "./blog-content.service.js";
import { Staff as Actor, StaffGuard } from "../admin/staff.guard.js";
import type { StaffActor } from "../admin/staff.service.js";
import { BlogAuthorsService } from "./blog-authors.service.js";
import { BlogPostsService } from "./blog-posts.service.js";

const PageQuery = z.object({ page: z.coerce.number().int().min(1).max(1000).default(1) });

/**
 * The blog section of the admin (/admin/blog). Signed in (global AuthGuard) and staff (StaffGuard);
 * what each role may do is `blogCan` (domain), checked in the services.
 */
@Controller("admin/blog")
@UseGuards(StaffGuard)
@UseInterceptors(NoStoreInterceptor)
export class BlogAdminController {
  constructor(
    private readonly posts: BlogPostsService,
    private readonly content: BlogContentService,
    private readonly authors: BlogAuthorsService,
  ) {}

  // ── Author profile and stats ─────────────────────────────────────

  /** The caller's public author profile (made on first visit). */
  @Get("profile")
  profile(@Actor() actor: StaffActor): Promise<BlogAuthorProfileDto> {
    return wire(this.authors.profile(actor));
  }

  @Put("profile")
  updateProfile(
    @Actor() actor: StaffActor,
    @ZodBody(BlogProfileSchema) input: BlogProfileInput,
  ): Promise<BlogAuthorProfileDto> {
    return wire(this.authors.updateProfile(actor, input));
  }

  /** Who a post can be assigned to (the whole team). */
  @Get("authors")
  authorOptions(): Promise<BlogAuthorOptionDto[]> {
    return this.authors.options();
  }

  @Get("stats")
  stats(@Actor() actor: StaffActor): Promise<BlogStatsDto> {
    return wire(this.posts.stats(actor));
  }

  // ── Posts ───────────────────────────────────────────────────────────

  @Get("posts")
  list(
    @Actor() actor: StaffActor,
    @Query(new ZodPipe(BlogAdminPostQuerySchema)) q: BlogAdminPostQuery,
  ): Promise<BlogAdminPostPageDto> {
    return wire(this.posts.list(actor, q));
  }

  @Post("posts")
  create(
    @Actor() actor: StaffActor,
    @ZodBody(BlogPostCreateSchema) input: BlogPostCreateInput,
  ): Promise<BlogAdminPostDto> {
    return wire(this.posts.create(actor, input));
  }

  @Get("posts/:id")
  get(@Actor() actor: StaffActor, @Param("id") id: string): Promise<BlogAdminPostDto> {
    return wire(this.posts.get(actor, id));
  }

  @Put("posts/:id")
  update(
    @Actor() actor: StaffActor,
    @Param("id") id: string,
    @ZodBody(BlogPostUpdateSchema) input: BlogPostUpdateInput,
  ): Promise<BlogAdminPostDto> {
    return wire(this.posts.update(actor, id, input));
  }

  /** Live now, or scheduled when `publishAt` is in the future. */
  @Post("posts/:id/publish")
  @HttpCode(200)
  publish(
    @Actor() actor: StaffActor,
    @Param("id") id: string,
    @ZodBody(BlogPublishSchema) { publishAt }: BlogPublishInput,
  ): Promise<BlogAdminPostDto> {
    return wire(this.posts.publish(actor, id, publishAt));
  }

  @Post("posts/:id/unpublish")
  @HttpCode(200)
  unpublish(@Actor() actor: StaffActor, @Param("id") id: string): Promise<BlogAdminPostDto> {
    return wire(this.posts.unpublish(actor, id));
  }

  @Delete("posts/:id")
  @HttpCode(204)
  async remove(@Actor() actor: StaffActor, @Param("id") id: string) {
    await this.posts.remove(actor, id);
  }

  @Get("posts/:id/revisions")
  revisions(@Actor() actor: StaffActor, @Param("id") id: string): Promise<BlogRevisionDto[]> {
    return wire(this.posts.revisions(actor, id));
  }

  @Get("posts/:id/revisions/:revisionId")
  revision(
    @Actor() actor: StaffActor,
    @Param("id") id: string,
    @Param("revisionId") revisionId: string,
  ): Promise<BlogRevisionDetailDto> {
    return wire(this.posts.revision(actor, id, revisionId));
  }

  @Post("posts/:id/revisions/:revisionId/restore")
  @HttpCode(200)
  restore(
    @Actor() actor: StaffActor,
    @Param("id") id: string,
    @Param("revisionId") revisionId: string,
  ): Promise<BlogAdminPostDto> {
    return wire(this.posts.restore(actor, id, revisionId));
  }

  // ── Categories and tags ─────────────────────────────────────────────

  @Get("categories")
  categories(): Promise<BlogCategoryDto[]> {
    return this.content.categories({ publicOnly: false });
  }

  @Post("categories")
  createCategory(
    @Actor() actor: StaffActor,
    @ZodBody(BlogCategoryInputSchema) input: BlogCategoryInput,
  ): Promise<BlogCategoryDto> {
    return this.content.saveCategory(actor, input);
  }

  @Put("categories/:id")
  updateCategory(
    @Actor() actor: StaffActor,
    @Param("id") id: string,
    @ZodBody(BlogCategoryInputSchema) input: BlogCategoryInput,
  ): Promise<BlogCategoryDto> {
    return this.content.saveCategory(actor, input, id);
  }

  @Delete("categories/:id")
  @HttpCode(204)
  async deleteCategory(@Actor() actor: StaffActor, @Param("id") id: string) {
    await this.content.deleteCategory(actor, id);
  }

  @Get("tags")
  tags(): Promise<BlogTagDto[]> {
    return this.content.tags({ publicOnly: false });
  }

  @Post("tags")
  createTag(
    @Actor() actor: StaffActor,
    @ZodBody(BlogTagInputSchema) input: BlogTagInput,
  ): Promise<BlogTagDto> {
    return this.content.saveTag(actor, input);
  }

  @Put("tags/:id")
  updateTag(
    @Actor() actor: StaffActor,
    @Param("id") id: string,
    @ZodBody(BlogTagInputSchema) input: BlogTagInput,
  ): Promise<BlogTagDto> {
    return this.content.saveTag(actor, input, id);
  }

  @Delete("tags/:id")
  @HttpCode(204)
  async deleteTag(@Actor() actor: StaffActor, @Param("id") id: string) {
    await this.content.deleteTag(actor, id);
  }

  // ── Redirects ───────────────────────────────────────────────────────

  @Get("redirects")
  redirects(@Actor() actor: StaffActor): Promise<BlogRedirectDto[]> {
    return wire(this.content.redirects(actor));
  }

  @Post("redirects")
  addRedirect(
    @Actor() actor: StaffActor,
    @ZodBody(BlogRedirectInputSchema) input: BlogRedirectInput,
  ): Promise<BlogRedirectDto> {
    return wire(this.content.addRedirect(actor, input));
  }

  @Delete("redirects/:id")
  @HttpCode(204)
  async deleteRedirect(@Actor() actor: StaffActor, @Param("id") id: string) {
    await this.content.deleteRedirect(actor, id);
  }

  // ── Media ───────────────────────────────────────────────────────────

  @Get("media")
  media(
    @Actor() actor: StaffActor,
    @Query(new ZodPipe(PageQuery)) { page }: z.infer<typeof PageQuery>,
  ): Promise<{ media: BlogMediaDto[]; page: number; pages: number; total: number }> {
    return wire(this.content.media(actor, page));
  }

  /** Registers an image and returns a signed URL to PUT the file to. */
  @Post("media")
  upload(
    @Actor() actor: StaffActor,
    @ZodBody(BlogMediaUploadSchema) input: BlogMediaUploadInput,
  ): Promise<{ media: BlogMediaDto; uploadUrl: string }> {
    return wire(this.content.createUpload(actor, input));
  }

  @Patch("media/:id")
  updateMedia(
    @Actor() actor: StaffActor,
    @Param("id") id: string,
    @ZodBody(BlogMediaUpdateSchema) { alt }: BlogMediaUpdateInput,
  ): Promise<BlogMediaDto> {
    return wire(this.content.updateMedia(actor, id, alt));
  }

  @Delete("media/:id")
  @HttpCode(204)
  async deleteMedia(@Actor() actor: StaffActor, @Param("id") id: string) {
    await this.content.deleteMedia(actor, id);
  }
}
