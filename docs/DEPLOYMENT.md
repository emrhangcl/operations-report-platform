# Deployment

The application is self-hosted: one Next.js server process (`apps/admin`) and one PostgreSQL 18 database. The primary target today is a local Windows machine (see `README.md`); `docs/self-hosting.md` describes running the same build on a Linux server.

## Build Commands

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

`pnpm run build` runs `pnpm --filter @operations/admin build && pnpm --filter @operations/mobile typecheck`. The admin build is `next build`; set `NEXT_STANDALONE=true` to produce the standalone server used by the Docker image. The mobile package has Expo start commands and a TypeScript check, but no production mobile release script.

## Environment Requirements

`.env.example` documents every variable. The server reads them from the process environment or the repository root `.env`.

Required at runtime:

- `APP_URL`: canonical origin. Used for links in emails, CSRF origin checks, and cookie security (`https://` enables `Secure` and `__Host-` cookies plus `upgrade-insecure-requests`). Mandatory in production.
- `DATABASE_URL`: runtime connection as `ops_app`.
- `AUTH_SECRET`: at least 32 random characters; signs storage download links. Changing it invalidates outstanding signed links only.

Required for operations:

- `DATABASE_MIGRATION_URL`: `ops_owner` connection for `pnpm db:migrate`; not needed by the running server.
- `OPS_DATA_DIR`: data root for uploaded files (`storage/`), the mail outbox (`mail-outbox/`), and, locally, the PostgreSQL cluster. Must be persistent and backed up.

Optional:

- `APP_ENV`, `AUTH_REQUIRE_EMAIL_VERIFICATION` (recommended `true` in production), session and lockout settings (`AUTH_*`), `DATA_MAX_ROWS`, `MAIL_FROM`, `STORAGE_DIR`, `MAIL_OUTBOX_DIR`.
- Payment providers: `PAYMENT_PROVIDER`, `IYZICO_*`, `PAYTR_*`.
- Local tooling only: `PG_BIN_DIR`, `OPS_PG_PORT`, `TEST_DATABASE_URL`, `TEST_DATABASE_MIGRATION_URL`, `E2E_*`.

All of these are server-only. No secret is compiled into the browser bundle; the mobile app only needs `EXPO_PUBLIC_API_URL`.

## Deployment-Related Configuration

- `Dockerfile`: builds the standalone admin server on Node 22, removes source maps and TypeScript build info, runs as non-root `nextjs` (UID 1001), exposes port `3000`, declares `/data` as a volume (`OPS_DATA_DIR=/data`), and health-checks `/api/health`.
- `compose.yaml`: runs the web service with `APP_URL`, `DATABASE_URL`, and `AUTH_SECRET` from the environment, binds `127.0.0.1:3000`, mounts the `app-data` volume at `/data`, uses a read-only root filesystem with tmpfs for `/tmp` and the Next cache, drops all Linux capabilities, and sets `no-new-privileges`. The database is not part of the compose file.
- `apps/admin/next.config.mjs`: security headers and CSP, standalone output, file tracing for PDF fonts, `pg` as an external server package.
- `.dockerignore`: keeps `.env*`, tests, docs, scripts, and the mobile app out of the image.

The Docker files have not been exercised on the current Windows development machine (Docker is not installed there); validate them on the target server before relying on them.

## Database Migrations

Schema, RLS, storage, trigger, function, and grant changes ship as new files in `db/migrations`. Apply them before starting a new application version:

```bash
pnpm db:migrate
```

The runner uses `DATABASE_MIGRATION_URL`, takes an advisory lock, applies pending files in order inside transactions, and refuses to run if an applied file was modified. Take a backup first (see `docs/DATABASE.md`). There is no automatic down migration: roll back application code if needed and fix data with a new forward migration.

The organization reopen/delete feature (platform detail page) is part of the `0002` baseline: deletion requires the exact organization slug, freezes the tenant, records a manifest of accounts and files, purges tenant data transactionally, then removes stored files and login accounts on the server and finally the organization. A failed cleanup leaves the organization closed and resumable; never clear a deletion marker or reopen a partially purged tenant, and never use a real organization deletion as a smoke test. `db/tests/platform_organization_management.test.sql` and `customer_report_signatures.test.sql` cover this path.

## Pre-Deployment Checks

1. `pnpm install` if dependencies changed.
2. `pnpm run typecheck`, `pnpm run lint`, `pnpm run test`.
3. `pnpm db:test` when migrations, policies, or triggers changed.
4. `pnpm test:e2e` against a staging instance or the local app.
5. `pnpm run build`.
6. Confirm the required environment variables on the target.
7. Back up the database and `OPS_DATA_DIR/storage`, then `pnpm db:migrate`.
8. Start the new version and check `GET /api/health`.
9. Sign in once per role (platform owner, organization admin, personnel) and open a report PDF.

## Not Yet Documented

- Automated backup and restore drills.
- Production SMTP provider for outgoing mail (currently the local outbox).
- Mobile app store or EAS release process.
- Payment provider production onboarding and webhook configuration.
- Shared rate limiting and session handling for more than one application instance.
