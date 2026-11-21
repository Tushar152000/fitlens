import { Controller, Get, Header, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import {
  BlogPostListQuerySchema,
  type BlogAuthorDto,
  type BlogCategoryDto,
  type BlogPostDto,
  type BlogPostListQuery,
  type BlogPostPageDto,
  type BlogSitemapDto,
  type BlogTagDto,
} from "@fitr8/contracts";
import { Public } from "../../common/auth/decorators.js";
import { AppError } from "../../common/errors.js";
import { ZodQuery } from "../../common/http/zod.js";
import { wire } from "../../common/http/wire.js";
import { InjectEnv, type Env } from "../../config/config.module.js";
import { BlogContentService } from "./blog-content.service.js";
import { BlogPostsService } from "./blog-posts.service.js";
import { BlogAuthorsService } from "./blog-authors.service.js";

const PUBLIC_CACHE = "public, max-age=60, stale-while-revalidate=600";

/** What readers (and the web's server rendering) see. No sign-in; only live posts. */
@Public()
@Controller("blog")
export class BlogController {
  constructor(
    private readonly posts: BlogPostsService,
    private readonly content: BlogContentService,
    private readonly authors: BlogAuthorsService,
    @InjectEnv() private readonly env: Env,
  ) {}

  @Get("posts")
  @Header("Cache-Control", PUBLIC_CACHE)
  list(@ZodQuery(BlogPostListQuerySchema) q: BlogPostListQuery): Promise<BlogPostPageDto> {
    return wire(this.posts.publicList(q));
  }

  /** 404 with `details.redirectTo` when the post moved (the web answers 308). */
  @Get("posts/:slug")
  @Header("Cache-Control", PUBLIC_CACHE)
  async post(@Param("slug") slug: string): Promise<BlogPostDto> {
    const post = await this.posts.publicPost(slug);
    if (post) return wire(post);
    const redirectTo = await this.content.redirectFor(slug);
    throw new AppError(404, "Post not found", redirectTo ? { redirectTo } : undefined);
  }

  @Get("categories")
  @Header("Cache-Control", PUBLIC_CACHE)
  categories(): Promise<BlogCategoryDto[]> {
    return this.content.categories({ publicOnly: true });
  }

  @Get("categories/:slug")
  @Header("Cache-Control", PUBLIC_CACHE)
  category(@Param("slug") slug: string): Promise<BlogCategoryDto> {
    return this.content.category(slug);
  }

  @Get("tags")
  @Header("Cache-Control", PUBLIC_CACHE)
  tags(): Promise<BlogTagDto[]> {
    return this.content.tags({ publicOnly: true });
  }

  @Get("tags/:slug")
  @Header("Cache-Control", PUBLIC_CACHE)
  tag(@Param("slug") slug: string): Promise<BlogTagDto> {
    return this.content.tag(slug);
  }

  @Get("authors/:slug")
  @Header("Cache-Control", PUBLIC_CACHE)
  author(@Param("slug") slug: string): Promise<BlogAuthorDto> {
    return this.authors.publicAuthor(slug);
  }

  /** Every indexable blog URL, for the web's sitemap.xml. */
  @Get("sitemap")
  @Header("Cache-Control", PUBLIC_CACHE)
  sitemap(): Promise<BlogSitemapDto> {
    return wire(this.posts.sitemap());
  }

  @Get("rss.xml")
  @Header("Cache-Control", "public, max-age=600")
  @Header("Content-Type", "application/rss+xml; charset=utf-8")
  rss(): Promise<string> {
    return this.posts.rss(`${this.env.API_PUBLIC_URL.replace(/\/+$/, "")}/api/blog/rss.xml`);
  }

  /** Blog images (public by design). */
  @Get("media/:file")
  media(@Param("file") file: string, @Res() res: Response): Promise<void> {
    return this.content.streamMedia(file, res);
  }
}
