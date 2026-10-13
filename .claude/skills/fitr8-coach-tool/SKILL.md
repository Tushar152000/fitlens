---
name: fitr8-coach-tool
description: Add or change a tool, prompt rule or context behaviour of the FITR8 AI coach (the Claude agent loop in apps/api/src/modules/coach). Use when the coach should be able to read or do something new, or when changing its system prompt, model, effort, limits or caching.
---

# Coach agent: adding capabilities safely

Architecture: `docs/ARCHITECTURE.md` §3.4. Code: `apps/api/src/modules/coach/`.

```
agent/agent-loop.ts     the loop (framework-free, unit-tested) — rarely needs changes
agent/claude.gateway.ts Claude request: model, effort, caching, compaction, fallbacks
agent/mock.gateway.ts   scripted model for AI_PROVIDER=mock (dev, e2e, CI)
tools/coach-toolbox.ts  the tools — add new ones here
coach.prompt.ts         frozen system prompt
coach.service.ts        persistence, limits, AiCall accounting
```

## Add a tool

1. Implement the behaviour in the owning module's service first (with its own e2e test). A tool is a thin call into an application service — never Prisma directly, never business rules in the tool.
2. Add a `defineTool({...})` entry in `CoachToolbox.forUser` (append — tool order is part of the cached prefix):
   - `name`: snake_case verb (`get_…` for reads, `log_…` / `draft_…` for writes)
   - `label`: present-tense status shown to the user ("Checking your sleep")
   - `description`: what it returns and _when to use it_; the model picks tools from this text
   - `input`: Zod schema with tight bounds (`.min/.max`, enums). Invalid input never reaches `run`
   - `run`: close over `userId` (never accept a user id as input); return `forModel(...)` to strip ids/URLs
3. Writes must be small and reversible, or produce a draft the user confirms in the UI. The model never confirms meals, changes targets, deletes data or touches another user.
4. Import the owning module in `coach.module.ts` if it isn't already.
5. Teach `MockGateway.pickTool` a keyword for it, and add an e2e case to `apps/api/test/coach.e2e.spec.ts` asserting the `tool` event and the side effect.

## Change the prompt

`coach.prompt.ts` must stay byte-stable per deploy: no dates, names or per-user values (they belong in the user turn's `<context>` block, built in `CoachService.prepareTurn`). Every edit resets the prompt cache for all users. Keep rules short and concrete; numbers must come from tools.

## Rules that keep the transcript valid

- History is append-only; never edit or delete stored `CoachMessage.content`.
- Assistant `tool_use` turns are persisted only together with their `tool_result` message (`onStep`).
- All `tool_result`s of one turn go in one user message.
- Forced `tool_choice` (`any`/`tool`) is rejected by current models; the loop uses `auto`, and `none` on the last iteration.

## Verify

```bash
cd apps/api && npx vitest run src/modules/coach test/coach.e2e.spec.ts
```

With a real key (`AI_PROVIDER=anthropic`), check `usage.cache_read_input_tokens` > 0 on the second turn (`coach_messages.cacheReadTokens`); zero means something volatile leaked into the cached prefix.
