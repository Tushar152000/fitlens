import { Module } from "@nestjs/common";
import { AdminModule } from "../admin/admin.module.js";
import { BlogAdminController } from "./blog-admin.controller.js";
import { BlogAuthorsService } from "./blog-authors.service.js";
import { BlogContentService } from "./blog-content.service.js";
import { BlogUrls } from "./blog-dto.js";
import { BlogPostsService } from "./blog-posts.service.js";
import { BlogController } from "./blog.controller.js";

/**
 * The blog (docs/BLOG.md): public reads for /blog and the blog section of the admin
 * (/api/admin/blog/*, behind the admin's StaffGuard). Owns every blog_* table; staff and roles come
 * from AdminModule, users only through UsersService (global).
 */
@Module({
  imports: [AdminModule],
  controllers: [BlogController, BlogAdminController],
  providers: [BlogUrls, BlogAuthorsService, BlogContentService, BlogPostsService],
})
export class BlogModule {}
