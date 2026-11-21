# FITR8 admin

One staff admin at `/admin` for every internal tool. The blog is the first section; more
(users, foods, reports…) plug into the same sign-in, roles, guard and menu.

```
/admin/login        Google sign-in (dev email sign-in locally)
/admin              Home: one card per section + the team
/admin/team         Staff and roles (everyone sees it; admins change it)
/admin/no-access    Signed in, but not staff
/admin/blog/*       Blog section (docs/BLOG.md)
```

## Staff and roles

Staff sign in with their normal Google account; that creates an ordinary FITR8 user. Access is a
`staff_members` row owned by the `admin` module (`apps/api/src/modules/admin`).

| Role   | Everywhere                | Blog section                                                      |
| ------ | ------------------------- | ----------------------------------------------------------------- |
| ADMIN  | Everything, plus the team | Everything                                                        |
| EDITOR | Runs content              | Publishes, edits every post, categories, tags, redirects, authors |
| AUTHOR | Contributes               | Writes own drafts; an editor publishes                            |

- Rules are pure functions: `@fitr8/domain/staff` (`staffCan`: the team) and each section's own map
  (`@fitr8/domain/blog` `blogCan`). The API enforces them; the web only hides what you can't do.
- **First admins:** `ADMIN_EMAILS` on the API (comma separated Google emails). They become (and stay)
  ADMIN on first visit; the UI can't demote or remove them ("Set in ADMIN_EMAILS").
- **Inviting:** `/admin/team` → email + role. The row shows "Invited" until that account first opens
  `/admin`, then links to it. The last other admin can't be removed or demoted.
- Removing someone keeps their work (blog posts stay, without an author).

## API

- `GET /api/admin/me` → `AdminMeDto`: the staff member, `can.manageTeam`, and one permission block
  per section (`sections.blog`). The web builds its menu from it.
- `GET/POST /api/admin/staff`, `PATCH/DELETE /api/admin/staff/:id`.
- Every `/api/admin/**` controller uses `@UseGuards(StaffGuard)` (after the global AuthGuard) and gets
  the caller with `@Staff() actor: StaffActor`. Not staff → 403 with the "no access" message.

## Adding a section

1. **Rules:** `packages/domain/src/<section>.ts` — a `<section>Can(role, action)` over `StaffRole`.
2. **API:** a module that imports `AdminModule`; its controller is `@Controller("admin/<section>")`
   with `@UseGuards(StaffGuard)` and `NoStoreInterceptor`. It owns its own tables; staff come from
   `StaffService`.
3. **Permissions:** add `sections.<section>` to `AdminMeDto` (`packages/contracts/src/admin.ts`) and
   fill it in `StaffService.me`.
4. **Web:** pages under `apps/web/src/app/admin/(panel)/<section>/` (they get the shell and
   `requireStaff()`), a group in `SECTIONS` (`components/admin/admin-nav.tsx`) and a card on the
   home page (`app/admin/(panel)/page.tsx`). Browser calls: `adminApi("/<section>/...")`.
5. **Tests:** `apps/api/test/<section>.e2e.spec.ts` (401, 403 for non-staff, role checks, happy path).

## Code

- API: `modules/admin/` (`staff.service.ts`, `staff.guard.ts`, `admin.controller.ts`); e2e
  `test/admin.e2e.spec.ts`.
- Web: `app/admin/` (login, no-access, `(panel)/layout.tsx`), `components/admin/` (shell, nav,
  team, shared UI), `lib/admin/` (`adminApi`/`blogApi`, `requireStaff`).
