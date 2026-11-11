---
name: fitr8-loop
description: Run any multi-step FITR8 change as a read → plan → make → verify loop that repeats until the done criteria pass, then refreshes the knowledge base in .claude/context/. Use for bug fixes, features, refactors or ship-readiness tasks in this monorepo that touch more than one file or need verification.
---

# FITR8 agent loop: read → plan → make → verify → repeat until done

Combine with `fitr8-feature` (new endpoint/table/screen) or `fitr8-coach-tool` (coach) for the how-to of each piece; this skill is the outer loop.

## 0. Read (context first, code second)

1. `node .claude/context/ctx.mjs status`. If a section you need is stale, read the changed files it lists before trusting its notes.
2. Read the relevant `.claude/context/*.md` sections, then `risks.md` and `decisions.md` entries for the area.
3. Read the actual code you will touch (and its tests). The notes point you there; they never replace reading it.
4. If an open question in `decisions.md` blocks the task, ask the user (one question, with your recommendation) before planning.

## 1. Plan

Write a short plan in the conversation (or a scratchpad file for big tasks):

- Goal and **done criteria** — always includes: `pnpm check` green; every new/changed route has e2e coverage (401, 400, 404, happy path); UI matches `docs/DESIGN.md`; docs touched by the change agree with code.
- Steps in dependency order: contracts → domain (+tests) → db migration → api service/controller → e2e → web/mobile UI.
- Risks: migrations (irreversible?), OTA/native impact (needs `app.json` version bump?), env vars (add to `env.ts` + `.env.example` + `.env.production.example`), breaking API changes for already-shipped app builds.

## 2. Make

Implement one step at a time. Small, reviewable edits. Follow `docs/ARCHITECTURE.md`. Use Node 22 (`export PATH=$HOME/.nvm/versions/node/v22.22.0/bin:$PATH`).

## 3. Verify (after every step, not just at the end)

Fastest relevant check first, then widen:

```bash
pnpm --filter @fitr8/domain test
pnpm --filter @fitr8/api test -- <name>      # e2e needs Postgres: pnpm infra:up
pnpm --filter @fitr8/web typecheck
pnpm check                                     # final gate (lint + typecheck + test, all workspaces)
```

On failure: read the error, fix the cause (not the test), re-run. Note each failed attempt in one line so you don't retry the same idea.

## 4. Loop

Go back to **Read** for the next step, or when a check reveals something you didn't know. Stop when all done criteria pass. Hard stops — report to the user instead of pushing on:

- the same check fails 3 times for the same reason,
- the fix needs a product decision, a destructive migration, secrets, or production/console access,
- scope grows beyond what was asked.

## 5. Close out

1. Update `.claude/context/` notes for every area you changed (facts + `path:line`), move fixed items out of `risks.md`, record decisions in `decisions.md`.
2. `node .claude/context/ctx.mjs sync <sections>` (the Stop hook will remind you if you forget).
3. Report: what changed, what was verified (actual command output), what's left. Don't commit or push unless asked.
