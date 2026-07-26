# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

FROM base AS runner
WORKDIR /app
ENV PATH="/app/node_modules/.bin:$PATH"
COPY pnpm-workspace.yaml package.json tsconfig.json ./
COPY src/shared/package.json ./src/shared/package.json
COPY src/web/package.json ./src/web/package.json
COPY src/worker/package.json ./src/worker/package.json
COPY src/shared ./src/shared
COPY src/worker ./src/worker
RUN pnpm install
RUN pnpm -F @longyuan/shared build
WORKDIR /app/src/worker
RUN tsc
ENV NODE_ENV=production
HEALTHCHECK --interval=30s --timeout=10s --retries=5 \
  CMD node dist/healthcheck.js
CMD ["node", "dist/index.js"]
