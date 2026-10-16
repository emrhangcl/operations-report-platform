# syntax=docker/dockerfile:1.7

# Sunucu dagitimi icin Next.js imaji. Yerel Windows kurulumu Docker gerektirmez (bkz. README).
# Veritabani (PostgreSQL 18) imajin disindadir; baglanti calisma zamaninda DATABASE_URL ile verilir.

FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/admin/package.json apps/admin/package.json
COPY packages/data-client/package.json packages/data-client/package.json
COPY packages/payments/package.json packages/payments/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/validation/package.json packages/validation/package.json

RUN corepack pnpm install --frozen-lockfile --filter @operations/admin...

FROM base AS builder

ENV NEXT_STANDALONE=true

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/apps/admin/node_modules ./apps/admin/node_modules
COPY --from=dependencies /app/packages ./packages
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/admin ./apps/admin
COPY packages ./packages

RUN corepack pnpm --filter @operations/admin build

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV APP_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV OPS_DATA_DIR=/data

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --home-dir /app nextjs

WORKDIR /app

COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public

RUN find /app -type f -name '*.map' -delete \
  && find /app -type f -name '*.tsbuildinfo' -delete

RUN mkdir -p /app/apps/admin/.next/cache /data/storage /data/mail-outbox \
  && chown -R nextjs:nodejs /app/apps/admin/.next/cache /data

USER nextjs

EXPOSE 3000

VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

CMD ["node", "apps/admin/server.js"]
