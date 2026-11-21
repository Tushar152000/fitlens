import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./support/app.js";

/** The blog: public reads and the staff admin (roles, posts, revisions, redirects, taxonomy, media). */
describe("blog", () => {
  let t: TestApp;
  const adminEmail = `blog-admin-${randomUUID()}@test.fitlens`;
  const run = randomUUID().slice(0, 8);
  const body = (words: number) =>
    `<h2>Why protein</h2><p>${Array(words).fill("protein").join(" ")}</p><h3>Tips</h3><p>Eat dal.</p>`;

  beforeAll(async () => {
    t = await createTestApp({ env: { ADMIN_EMAILS: adminEmail.toUpperCase() } });
  });
  afterAll(() => t.close());

  /** A browser signed in by email (dev login). */
  async function as(email: string, name = "Staff Person") {
    const agent = t.browser();
    await agent.post("/api/auth/dev").send({ email, name }).expect(200);
    return agent;
  }

  it("requires sign-in for the admin and team membership", async () => {
    await t.http().get("/api/admin/me").expect(401);
    const { agent } = await t.signIn();
    const res = await agent.get("/api/admin/me").expect(403);
    expect(res.body.error).toMatch(/isn't on the FITR8 team/);
    await agent.post("/api/admin/blog/posts").send({}).expect(403);
  });

  it("makes ADMIN_EMAILS admins on first visit, with an author profile on first blog use", async () => {
    const admin = await as(adminEmail, "Asha Rao");
    const me = await admin.get("/api/admin/me").expect(200);
    expect(me.headers["cache-control"]).toBe("no-store");
    expect(me.body.staff).toMatchObject({
      role: "ADMIN",
      name: "Asha Rao",
      joined: true,
      fixed: true,
    });
    expect(me.body.can).toEqual({ manageTeam: true });
    expect(me.body.sections.blog).toEqual({
      publish: true,
      manageContent: true,
      assignAuthor: true,
    });
    const profile = await admin.get("/api/admin/blog/profile").expect(200);
    expect(profile.body).toMatchObject({
      staffId: me.body.staff.id,
      name: "Asha Rao",
      postCount: 0,
    });
    expect(profile.body.slug).toMatch(/^asha-rao/);
  });

  it("writes, autosaves, publishes, renames with a redirect and serves the post", async () => {
    const admin = await as(adminEmail);
    const created = await admin
      .post("/api/admin/blog/posts")
      .send({ title: `Protein guide ${run}` })
      .expect(201);
    const id = created.body.id as string;
    expect(created.body).toMatchObject({
      status: "DRAFT",
      slug: `protein-guide-${run}`,
      can: { edit: true },
    });

    await admin.put(`/api/admin/blog/posts/${id}`).send({ slug: "Not A Slug" }).expect(400);
    await admin.put(`/api/admin/blog/posts/${id}`).send({ slug: "category" }).expect(400);
    await admin.put(`/api/admin/blog/posts/${id}`).send({ contentHtml: "<p>x</p>" }).expect(400);
    await admin.put(`/api/admin/blog/posts/${id}`).send({ categoryId: "nope" }).expect(400);
    await admin.put("/api/admin/blog/posts/missing").send({ title: "x" }).expect(404);
    // Nothing to read yet.
    await admin.post(`/api/admin/blog/posts/${id}/publish`).send({}).expect(400);

    const category = await admin
      .post("/api/admin/blog/categories")
      .send({ name: `Nutrition ${run}`, description: "Food first" })
      .expect(201);
    expect(category.body).toMatchObject({ slug: `nutrition-${run}`, postCount: 0 });
    await admin
      .post("/api/admin/blog/categories")
      .send({ name: `Nutrition ${run}` })
      .expect(409);
    const tag = await admin
      .post("/api/admin/blog/tags")
      .send({ name: `Veg ${run}` })
      .expect(201);

    const saved = await admin
      .put(`/api/admin/blog/posts/${id}`)
      .send({
        contentJson: { type: "doc", content: [] },
        contentHtml: `${body(300)}<script>alert(1)</script>`,
        excerpt: "How much protein you need.",
        categoryId: category.body.id,
        tagIds: [tag.body.id],
        metaDescription: "A guide to protein.",
        faq: [{ question: "How much?", answer: "About 1.6 g per kg." }],
        baseUpdatedAt: created.body.updatedAt,
      })
      .expect(200);
    expect(saved.body.contentHtml).not.toContain("script");
    expect(saved.body.toc).toEqual([
      { id: "why-protein", text: "Why protein", level: 2 },
      { id: "tips", text: "Tips", level: 3 },
    ]);
    expect(saved.body.wordCount).toBeGreaterThan(300);
    expect(saved.body.readingMinutes).toBe(1);
    expect(saved.body.tagIds).toEqual([tag.body.id]);

    // A stale editor can't overwrite newer work.
    const conflict = await admin
      .put(`/api/admin/blog/posts/${id}`)
      .send({ title: "Old tab", baseUpdatedAt: created.body.updatedAt })
      .expect(409);
    expect(conflict.body.details.updatedAt).toBe(saved.body.updatedAt);

    // Not public while a draft.
    await t.http().get(`/api/blog/posts/protein-guide-${run}`).expect(404);

    const published = await admin.post(`/api/admin/blog/posts/${id}/publish`).send({}).expect(200);
    expect(published.body.status).toBe("PUBLISHED");
    expect(published.body.publishedAt).toBeTruthy();

    const pub = await t.http().get(`/api/blog/posts/protein-guide-${run}`).expect(200);
    expect(pub.headers["cache-control"]).toMatch(/public/);
    expect(pub.body).toMatchObject({
      title: `Protein guide ${run}`,
      category: { slug: `nutrition-${run}` },
      tags: [{ slug: `veg-${run}` }],
      faq: [{ question: "How much?" }],
      author: { name: "Asha Rao" },
      authorProfile: { name: "Asha Rao" },
    });
    expect(Array.isArray(pub.body.related)).toBe(true);
    expect(pub.body).not.toHaveProperty("contentJson");

    const list = await t.http().get(`/api/blog/posts?category=nutrition-${run}`).expect(200);
    expect(list.body.posts.map((p: { id: string }) => p.id)).toEqual([id]);
    expect((await t.http().get(`/api/blog/posts?q=${run}`).expect(200)).body.total).toBe(1);
    await t.http().get("/api/blog/posts?page=0").expect(400);

    const cats = await t.http().get("/api/blog/categories").expect(200);
    expect(cats.body.find((c: { slug: string }) => c.slug === `nutrition-${run}`).postCount).toBe(
      1,
    );
    await t.http().get(`/api/blog/tags/veg-${run}`).expect(200);
    await t.http().get(`/api/blog/categories/nope-${run}`).expect(404);

    // Rename a live post: the old URL redirects.
    await admin
      .put(`/api/admin/blog/posts/${id}`)
      .send({ slug: `protein-${run}` })
      .expect(200);
    const moved = await t.http().get(`/api/blog/posts/protein-guide-${run}`).expect(404);
    expect(moved.body.details).toEqual({ redirectTo: `/blog/protein-${run}` });
    const redirects = await admin.get("/api/admin/blog/redirects").expect(200);
    expect(
      redirects.body.find((r: { fromSlug: string }) => r.fromSlug === `protein-guide-${run}`),
    ).toMatchObject({
      auto: true,
      toPath: `/blog/protein-${run}`,
    });

    const sitemap = await t.http().get("/api/blog/sitemap").expect(200);
    expect(sitemap.body.posts.some((p: { slug: string }) => p.slug === `protein-${run}`)).toBe(
      true,
    );
    expect(
      sitemap.body.categories.some((c: { slug: string }) => c.slug === `nutrition-${run}`),
    ).toBe(true);

    const rss = await t.http().get("/api/blog/rss.xml").expect(200);
    expect(rss.headers["content-type"]).toMatch(/rss\+xml/);
    expect(rss.text).toContain(`http://localhost:3000/blog/protein-${run}`);

    const author = await t
      .http()
      .get(`/api/blog/authors/${me(pub.body)}`)
      .expect(200);
    expect(author.body.name).toBe("Asha Rao");

    // Unpublish: gone for readers.
    await admin.post(`/api/admin/blog/posts/${id}/unpublish`).expect(200);
    await t.http().get(`/api/blog/posts/protein-${run}`).expect(404);

    // Schedule for later: still hidden, counted as scheduled.
    const later = new Date(Date.now() + 86_400_000).toISOString();
    const scheduled = await admin
      .post(`/api/admin/blog/posts/${id}/publish`)
      .send({ publishAt: later })
      .expect(200);
    expect(scheduled.body.status).toBe("SCHEDULED");
    await t.http().get(`/api/blog/posts/protein-${run}`).expect(404);
    const stats = await admin.get("/api/admin/blog/stats").expect(200);
    expect(stats.body.upcoming.some((p: { id: string }) => p.id === id)).toBe(true);
    // The time passes (simulated): live without any job.
    await t.prisma.blogPost.update({
      where: { id },
      data: { publishedAt: new Date(Date.now() - 1000) },
    });
    await t.http().get(`/api/blog/posts/protein-${run}`).expect(200);
    const rows = await admin.get(`/api/admin/blog/posts?status=PUBLISHED&q=${run}`).expect(200);
    expect(rows.body.posts.map((p: { id: string }) => p.id)).toEqual([id]);
    expect(rows.body.counts.PUBLISHED).toBe(1);

    await admin.delete(`/api/admin/blog/posts/${id}`).expect(204);
    await admin.delete(`/api/admin/blog/posts/${id}`).expect(404);
  });

  it("keeps revisions and restores them", async () => {
    const admin = await as(adminEmail);
    const { body: post } = await admin
      .post("/api/admin/blog/posts")
      .send({ title: `Rev ${run}` })
      .expect(201);
    await admin
      .put(`/api/admin/blog/posts/${post.id}`)
      .send({ contentJson: { type: "doc" }, contentHtml: "<p>first version</p>", snapshot: true })
      .expect(200);
    await admin
      .put(`/api/admin/blog/posts/${post.id}`)
      .send({ contentJson: { type: "doc" }, contentHtml: "<p>second version</p>", snapshot: true })
      .expect(200);
    const revs = await admin.get(`/api/admin/blog/posts/${post.id}/revisions`).expect(200);
    expect(revs.body).toHaveLength(2);
    expect(revs.body[0]).toMatchObject({ reason: "manual", member: { name: "Asha Rao" } });
    // The newest revision holds what was there before the second save.
    const detail = await admin
      .get(`/api/admin/blog/posts/${post.id}/revisions/${revs.body[0].id}`)
      .expect(200);
    expect(detail.body.contentHtml).toBe("<p>first version</p>");
    await admin.get(`/api/admin/blog/posts/${post.id}/revisions/nope`).expect(404);

    const restored = await admin
      .post(`/api/admin/blog/posts/${post.id}/revisions/${revs.body[0].id}/restore`)
      .expect(200);
    expect(restored.body.contentHtml).toBe("<p>first version</p>");
    const after = await admin.get(`/api/admin/blog/posts/${post.id}/revisions`).expect(200);
    expect(after.body[0].reason).toBe("before restore");
  });

  it("invites a team and enforces roles", async () => {
    const admin = await as(adminEmail);
    const authorEmail = `author-${randomUUID()}@test.fitlens`;
    const editorEmail = `editor-${randomUUID()}@test.fitlens`;

    await admin.post("/api/admin/staff").send({ email: "nope", role: "AUTHOR" }).expect(400);
    const invited = await admin
      .post("/api/admin/staff")
      .send({ email: authorEmail, role: "AUTHOR", name: "Ravi K" })
      .expect(201);
    expect(invited.body).toMatchObject({ joined: false, role: "AUTHOR" });
    await admin.post("/api/admin/staff").send({ email: authorEmail, role: "EDITOR" }).expect(409);
    await admin.post("/api/admin/staff").send({ email: editorEmail, role: "EDITOR" }).expect(201);

    // The invite is claimed on first sign-in.
    const author = await as(authorEmail);
    const me = await author.get("/api/admin/me").expect(200);
    expect(me.body.staff).toMatchObject({ role: "AUTHOR", joined: true, name: "Ravi K" });
    expect(me.body.sections.blog.publish).toBe(false);

    const { body: draft } = await author
      .post("/api/admin/blog/posts")
      .send({ title: `Author post ${run}` })
      .expect(201);
    await author
      .put(`/api/admin/blog/posts/${draft.id}`)
      .send({ contentJson: { type: "doc" }, contentHtml: "<p>Words here</p>" })
      .expect(200);
    await author.post(`/api/admin/blog/posts/${draft.id}/publish`).send({}).expect(403);
    await author.put(`/api/admin/blog/posts/${draft.id}`).send({ featured: true }).expect(403);
    await author.post("/api/admin/blog/categories").send({ name: "Nope" }).expect(403);
    await author.get("/api/admin/blog/redirects").expect(403);
    await author
      .post("/api/admin/staff")
      .send({ email: "someone@example.com", role: "ADMIN" })
      .expect(403);

    // Authors don't see other people's posts.
    const { body: adminPost } = await admin
      .post("/api/admin/blog/posts")
      .send({ title: `Admin ${run}` })
      .expect(201);
    await author.get(`/api/admin/blog/posts/${adminPost.id}`).expect(404);
    const authorList = await author.get("/api/admin/blog/posts").expect(200);
    expect(
      authorList.body.posts.every((p: { author: { name: string } }) => p.author.name === "Ravi K"),
    ).toBe(true);

    // An editor publishes it; then the author can no longer edit it.
    const editor = await as(editorEmail);
    await editor.post(`/api/admin/blog/posts/${draft.id}/publish`).send({}).expect(200);
    await author.put(`/api/admin/blog/posts/${draft.id}`).send({ title: "Changed" }).expect(403);
    await editor
      .post("/api/admin/staff")
      .send({ email: "another@example.com", role: "AUTHOR" })
      .expect(403);
    await editor
      .put(`/api/admin/blog/posts/${draft.id}`)
      .send({ authorId: me.body.staff.id })
      .expect(200);
    await editor.put(`/api/admin/blog/posts/${draft.id}`).send({ authorId: "nobody" }).expect(400);

    // Roles and removal.
    await admin.patch(`/api/admin/staff/${invited.body.id}`).send({ role: "EDITOR" }).expect(200);
    expect((await author.get("/api/admin/me").expect(200)).body.sections.blog.publish).toBe(true);
    await admin.patch(`/api/admin/staff/${invited.body.id}`).send({ role: "OWNER" }).expect(400);
    await admin.patch("/api/admin/staff/missing").send({ role: "EDITOR" }).expect(404);
    const adminMe = (await admin.get("/api/admin/me").expect(200)).body.staff;
    await admin.delete(`/api/admin/staff/${adminMe.id}`).expect(409);
    await admin.delete(`/api/admin/staff/${invited.body.id}`).expect(204);
    await author.get("/api/admin/me").expect(403);
    // Their post stays, without an author.
    expect(
      (await admin.get(`/api/admin/blog/posts/${draft.id}`).expect(200)).body.authorId,
    ).toBeNull();
  });

  it("edits the author profile", async () => {
    const admin = await as(adminEmail);
    await admin.put("/api/admin/blog/profile").send({ name: "", slug: "x" }).expect(400);
    const res = await admin
      .put("/api/admin/blog/profile")
      .send({
        name: "Asha Rao",
        slug: `asha-${run}`,
        bio: "Dietitian.",
        avatarId: null,
        website: "https://asha.example",
        twitter: "asha",
        linkedin: "",
      })
      .expect(200);
    expect(res.body).toMatchObject({
      slug: `asha-${run}`,
      bio: "Dietitian.",
      linkedin: null,
    });
    await admin
      .put("/api/admin/blog/profile")
      .send({ name: "A", slug: `asha-${run}`, avatarId: "missing", website: null, linkedin: null })
      .expect(400);
  });

  it("manages redirects, tags and media", async () => {
    const admin = await as(adminEmail);
    await admin
      .post("/api/admin/blog/redirects")
      .send({ fromSlug: `old-${run}`, toPath: "//evil.com" })
      .expect(400);
    const r = await admin
      .post("/api/admin/blog/redirects")
      .send({ fromSlug: `old-${run}`, toPath: "/blog" })
      .expect(201);
    await admin
      .post("/api/admin/blog/redirects")
      .send({ fromSlug: `old-${run}`, toPath: "/" })
      .expect(409);
    expect((await t.http().get(`/api/blog/posts/old-${run}`).expect(404)).body.details).toEqual({
      redirectTo: "/blog",
    });
    await admin.delete(`/api/admin/blog/redirects/${r.body.id}`).expect(204);
    await admin.delete(`/api/admin/blog/redirects/${r.body.id}`).expect(404);

    const tag = await admin
      .post("/api/admin/blog/tags")
      .send({ name: `Tag ${run}` })
      .expect(201);
    const renamed = await admin
      .put(`/api/admin/blog/tags/${tag.body.id}`)
      .send({ name: `Tag ${run} renamed`, slug: `tag-${run}-x` })
      .expect(200);
    expect(renamed.body.slug).toBe(`tag-${run}-x`);
    await admin.put("/api/admin/blog/tags/missing").send({ name: "x" }).expect(404);
    await admin.delete(`/api/admin/blog/tags/${tag.body.id}`).expect(204);
    // Unused tags aren't public.
    await t.http().get(`/api/blog/tags/tag-${run}-x`).expect(404);

    await admin
      .post("/api/admin/blog/media")
      .send({ contentType: "image/svg+xml", sizeBytes: 10 })
      .expect(400);
    await admin
      .post("/api/admin/blog/media")
      .send({ contentType: "image/png", sizeBytes: 11 * 1024 * 1024 })
      .expect(400);
    const up = await admin
      .post("/api/admin/blog/media")
      .send({ contentType: "image/png", sizeBytes: 1000, alt: "A thali" })
      .expect(201);
    expect(up.body.uploadUrl).toMatch(/^http/);
    expect(up.body.media.url).toMatch(/\/api\/blog\/media\/[0-9a-f-]{36}\.png$/);
    const lib = await admin.get("/api/admin/blog/media").expect(200);
    expect(lib.body.media[0].id).toBe(up.body.media.id);
    const alt = await admin
      .patch(`/api/admin/blog/media/${up.body.media.id}`)
      .send({ alt: "Dal" })
      .expect(200);
    expect(alt.body.alt).toBe("Dal");

    // Cover images must exist.
    const { body: post } = await admin
      .post("/api/admin/blog/posts")
      .send({ title: `Cover ${run}` })
      .expect(201);
    await admin.put(`/api/admin/blog/posts/${post.id}`).send({ coverId: "missing" }).expect(400);
    const withCover = await admin
      .put(`/api/admin/blog/posts/${post.id}`)
      .send({ coverId: up.body.media.id, coverAlt: "Thali" })
      .expect(200);
    expect(withCover.body.cover.id).toBe(up.body.media.id);

    await t.http().get("/api/blog/media/../../etc/passwd").expect(404);
    await t.http().get(`/api/blog/media/${randomUUID()}.png`).expect(404);
    await admin.delete(`/api/admin/blog/media/${up.body.media.id}`).expect(204);
    expect((await admin.get(`/api/admin/blog/posts/${post.id}`).expect(200)).body.cover).toBeNull();
  });
});

/** The author slug from a public post. */
function me(post: { author: { slug: string } }) {
  return post.author.slug;
}
