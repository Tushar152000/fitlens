# FITR8 knowledge base

Verified, code-first notes about this repo so an agent (or a person) doesn't re-read 40k lines every session. Code is always the source of truth; these notes say where to look and what's true there.

| File           | Covers                                                          | Kept in sync with                             |
| -------------- | --------------------------------------------------------------- | --------------------------------------------- |
| `api.md`       | routes, auth, billing/Pro, AI + coach loop, storage, env, tests | `apps/api/`                                   |
| `web.md`       | Next 16 web: landing, onboarding, `/home`, proxy                | `apps/web/`                                   |
| `mobile.md`    | Expo app, auth, API usage, paywall, release config              | `apps/mobile/`                                |
| `packages.md`  | domain rules, contracts, db schema/migrations                   | `packages/`                                   |
| `infra.md`     | CI, deploy, OTA, Docker, local scripts, env templates           | `.github/`, `scripts/`, `infra/`, root config |
| `risks.md`     | ranked known bugs and ship risks, doc drift                     | by hand                                       |
| `decisions.md` | decisions made, open questions for the owner                    | by hand                                       |

## How it stays current (automatic)

- `sections.json` maps each file to the code paths it describes. `.index.json` stores a content hash of every file a section covered when its notes were last synced.
- **SessionStart hook** (also after `/compact`): injects this index plus any STALE sections and the exact files that changed (teammate commits, hand edits, anything).
- **PostToolUse hook** on Edit/Write: records which code files this session changed.
- **Stop hook**: if this session changed code in a section that is now stale, Claude is sent back once to update that section's notes and run `sync`. It never loops (`stop_hook_active`).

## Commands

```bash
node .claude/context/ctx.mjs status            # stale sections and changed files
node .claude/context/ctx.mjs sync api web      # after updating api.md / web.md
node .claude/context/ctx.mjs sync --all        # after a full refresh
```

## Writing rules

- Facts with `path:line` refs; no speculation. Mark unverified claims "(unverified)".
- Describe what the code does now, not history. Bugs go to `risks.md`, questions to `decisions.md`.
- Keep each file short enough to read in one go (≈150 lines). Prefer tables and one-line bullets.
- Never put secrets, user data or env values in these files — names only.
