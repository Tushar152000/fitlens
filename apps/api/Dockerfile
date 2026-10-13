# syntax=docker/dockerfile:1
# FITR8 API image. Build from the repo root:  docker build -f apps/api/Dockerfile -t fitr8-api .
# One image, three uses:
#   default            → HTTP API          (node dist/main.js)
#   command worker     → queue consumers   (node dist/worker.js)
#   --target migrate   → `prisma migrate deploy` as a release step
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
# openssl: Prisma's schema engine (used by the migrate target) links against it on alpine.
RUN apk add --no-cache libc6-compat openssl && corepack enable
WORKDIR /repo

# Only the workspaces the API depends on, with a pruned lockfile (turbo prune).
FROM base AS pruner
COPY . .
RUN npx -y turbo@2 prune @fitr8/api --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
COPY .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=@fitr8/api
# Self-contained production bundle: the api package plus its prod deps and built workspace packages.
RUN pnpm --filter @fitr8/api deploy --prod --legacy /prod/api

FROM builder AS migrate
WORKDIR /repo/packages/db
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache libc6-compat tini
ENV NODE_ENV=production APP_ROLE=api PORT=4000
WORKDIR /app
COPY --from=builder --chown=node:node /prod/api ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s CMD wget -qO- http://127.0.0.1:${PORT}/api/health/live || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
