# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json ./
COPY src/shared/package.json ./src/shared/package.json
COPY src/worker/package.json ./src/worker/package.json
RUN pnpm install

FROM base AS runner
WORKDIR /app/src/worker
ENV NODE_ENV=production
COPY --from=deps /app/node_modules /app/node_modules
COPY src/shared /app/src/shared
COPY src/worker .
RUN pnpm exec tsc
HEALTHCHECK --interval=30s --timeout=10s --retries=5 \
  CMD node dist/src/healthcheck.js
CMD ["node", "dist/src/index.js"]
