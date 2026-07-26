# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json ./
COPY src/shared/package.json ./src/shared/package.json
COPY src/web/package.json ./src/web/package.json
RUN pnpm install

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm install
RUN pnpm -F @longyuan/shared build
ENV NEXT_TELEMETRY_DISABLED=1
ENV APP_ROLE=web
RUN pnpm -F @longyuan/web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV APP_ROLE=web
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/src/web/.next/standalone ./
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => { if (!r.ok) throw new Error('healthcheck failed') }).catch(() => process.exit(1))"
CMD ["node", "server.js"]
