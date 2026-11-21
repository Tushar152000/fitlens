# FITR8 Blog

An own-built blog (no Ghost, no headless CMS): the public pages at `/blog` for search, and the
**Blog section of the FITR8 admin** at `/admin/blog` (sign-in, staff and roles: [ADMIN.md](ADMIN.md)). It reuses FITR8's Google sign-in, sessions, storage, tests and deploys, so there
is no extra service to run.

```
browser ──► www.fitr8.com/blog/*      Next server render, no cookie ──► GET  /api/blog/*        (public)
staff   ──► www.fitr8.com/admin/blog/* Next server render + cookie ──► /api/admin/blog/*    (staff only)
              └ Tiptap editor (browser) ─────────────────────────────► PUT  /api/admin/blog/posts/:id
images  ──► api.fitr8.com/api/blog/media/<uuid>.<ext>  (streamed from the private bucket, cached 1 year)
feed    ──► api.fitr8.com/api/blog/rss.xml
```

## Who can do what

Staff sign in once at `/admin/login` (see [ADMIN.md](ADMIN.md)); their **staff role** decides what
they can do on the blog (`@fitr8/domain/blog` `blogCan`, enforced by the API):

| Role   | On the blog                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------- |
| AUTHOR | Write drafts, edit/delete own unpublished posts, upload images, edit own author profile                              |
| EDITOR | Everything above for every post, publish / schedule / unpublish, feature, change author, categories, tags, redirects |
| ADMIN  | Same as editor (plus the team, in the admin itself)                                                                  |

- **Author profiles** (`blog_authors`, keyed by staff id): made from the staff name the first time
  someone writes or opens `/admin/blog/profile`; slug, bio, photo and links are public at
  `/blog/author/<slug>`. A post's author can be any staff member.

## Writing and publishing

- **Editor:** Tiptap 3 (StarterKit with links and underline, images, tables, YouTube via
  youtube-nocookie, placeholder). The browser sends Tiptap JSON (reloaded into the editor) plus HTML.
  The API **sanitises the HTML** (`modules/blog/blog-html.ts`, sanitize-html allowlist), turns h1 into
  h2, gives h2/h3 ids for the table of contents, and stores plain text, word count and reading time.
- **Autosave** 2 s after the last change; `Ctrl/⌘ S` saves a named version. Every save sends the
  `updatedAt` it started from: if someone saved in between, the API answers 409 and the editor stops
  autosaving until reload (no silent overwrite).
- **Revisions:** taken at most every 10 minutes while editing, and always on publish, schedule,
  restore and "Save version"; newest 50 kept. Restoring first saves the current words as a revision.
- **Publish now / schedule:** a future time stores `SCHEDULED`; readers' queries treat it as published
  once the time passes (no cron job). Unpublish returns it to draft and keeps the original date.
- **Preview:** `/admin/blog/posts/:id/preview` renders the draft with the same `Article` component as `/blog`.
- **Slugs:** follow the title while it's a new draft; editable. Reserved: `category`, `tag`, `author`,
  `page`, `rss`, `feed`, `search`. Renaming a **live** post adds a permanent redirect from the old URL
  (and re-points redirects that pointed at it). Manual redirects: `/admin/blog/redirects`.
- **Images:** `/admin/blog/media` or from the editor. The browser PUTs straight to storage with a 5-minute
  signed URL; the API serves them publicly. JPEG/PNG/WebP/GIF/AVIF, 10 MB. No SVG (scriptable).

## SEO

| What                 | Where                                                                                                                                                             |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server-rendered HTML | every `/blog` page; rendered per request, so the admin and the site never disagree                                                                                |
| Title, description   | `metaTitle` / `metaDescription`, falling back to title / excerpt                                                                                                  |
| Canonical            | `NEXT_PUBLIC_SITE_URL` + path, or the post's `canonicalUrl`                                                                                                       |
| noindex              | per post; also left out of the sitemap and RSS                                                                                                                    |
| Open Graph / Twitter | article type, published/modified time, author, section, tags, image (social image → cover)                                                                        |
| Structured data      | `BlogPosting`, `BreadcrumbList`, `FAQPage` (post FAQ), `ProfilePage` (authors), `Blog`                                                                            |
| Sitemap              | `app/sitemap.ts`: home, blog, live indexable posts, categories, tags, authors with posts                                                                          |
| robots.txt           | `app/robots.ts`: disallows `/admin` and the signed-in app                                                                                                         |
| RSS                  | `GET /api/blog/rss.xml`, linked from `/blog` (`<link rel="alternate">`)                                                                                           |
| Moved URLs           | 308 permanent redirect (API 404 with `details.redirectTo`, web `permanentRedirect`)                                                                               |
| Editor checklist     | `seoChecks` (domain): title/description length, words, subheadings, cover, alt text, links, focus keyword in title/description/URL/intro/subheading → 0–100 score |
| Archives             | `/blog/category/:slug`, `/blog/tag/:slug`, `/blog/author/:slug`, `?page=N` with canonical                                                                         |

## Setup

1. Migration: `20261121192809_admin_blog` (new tables only; safe to deploy before the code).
2. API env: `ADMIN_EMAILS` (the first admins of the whole admin).
3. Web env: `NEXT_PUBLIC_SITE_URL=https://www.fitr8.com` (build time; locally `PUBLIC_URL`).
4. Storage: the bucket already accepts browser PUTs for meal photos; blog uploads use the same CORS.
5. Sign in at `/admin/login`, invite the team at `/admin/team`, add categories at `/admin/blog/categories`, write.

## Code

- Rules: `packages/domain/src/blog.ts` (+ tests). Contract: `packages/contracts/src/blog.ts`.
- API: `apps/api/src/modules/blog/` — `blog.controller.ts` (public), `blog-admin.controller.ts`
  (`/api/admin/blog/*`, behind the admin's `StaffGuard`), services for posts, authors, content
  (categories, tags, redirects, media).
  e2e: `apps/api/test/blog.e2e.spec.ts`.
- Web public: `apps/web/src/app/(marketing)/blog/`, `components/blog/article.tsx`,
  `.blog-prose` in `globals.css`. Admin section: `apps/web/src/app/admin/(panel)/blog/`,
  `components/admin/` (editor, media, taxonomies, redirects, profile), `lib/admin/api.ts` `blogApi`.
