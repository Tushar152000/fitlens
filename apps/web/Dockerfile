# syntax=docker/dockerfile:1
# FITR8 web (Next.js standalone). Build from the repo root:  docker build -f apps/web/Dockerfile -t fitr8-web .
# Build arg: NEXT_PUBLIC_API_URL (the API's public origin, inlined for the browser).
# Runtime env: API_INTERNAL_URL (optional private address for server rendering).
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache libc6-compat && corepack enable
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN npx -y turbo@2 prune @fitr8/web --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
COPY .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm turbo run build --filter=@fitr8/web

FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache libc6-compat tini
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=builder --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
