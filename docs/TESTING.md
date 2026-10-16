# Testing

Three automated layers cover the system. Run them from the repository root.

| Command | What it runs | Needs |
| --- | --- | --- |
| `pnpm run test` | Vitest unit tests in every workspace package that has a `test` script, then `pnpm test:scripts` (tests under `scripts/`) | Nothing running |
| `pnpm db:test` | pgTAP security tests in `db/tests` against a freshly reset `operations_portal_test` database | Local PostgreSQL (`pnpm db:start`) |
| `pnpm test:e2e` | HTTP end-to-end flows and attack scenarios against the running app (`scripts/e2e/local-stack.ts`) | `pnpm dev:admin` running, `E2E_*` accounts in `.env` |

Supporting checks:

```bash
pnpm run typecheck
pnpm run lint
pnpm run build
```

`pnpm run typecheck` runs TypeScript checks in every workspace. `pnpm run lint` runs the admin ESLint configuration with zero allowed warnings. `pnpm run build` builds the admin app and typechecks the mobile app.

## Unit Tests (`pnpm run test`)

Packages with a `test` script: `@operations/admin`, `@operations/data-client`, `@operations/payments`, `@operations/shared`, `@operations/validation`. `@operations/types` and `@operations/mobile` have typechecks only.

Admin tests run with `apps/admin/vitest.config.ts`, which maps `server-only` to an empty module so server code can be imported outside Next.js.

Test files:

- Server security layer:
  - `apps/admin/lib/server/query/compiler.test.ts`: parameter binding, typed casts, relation embedding, unknown table/column and injection rejection, unfiltered update/delete refusal, row cap.
  - `apps/admin/lib/server/query/gateway-policy.test.ts`: table/action allowlist, anonymous access, request schema limits.
  - `apps/admin/lib/server/auth/http.test.ts`: origin checks, scope-bound cookies, CSRF rejection, mobile-only bearer tokens.
  - `apps/admin/lib/server/auth/password.test.ts`: scrypt format, verification, NFKC handling, malformed hashes, rehash detection.
  - `apps/admin/lib/server/storage.test.ts`: path traversal, bucket names, image signature detection, signed link verification.
  - `apps/admin/lib/server/guards.test.ts`: `401`/`403` status for every guard failure, read-only versus write access, personnel versus admin, platform admin grant.
  - `apps/admin/lib/server/encryption.test.ts`: storage encryption round trip, fresh IV per write, tamper detection, path binding, unknown keys, key rotation, legacy plaintext files.
  - `apps/admin/lib/client-address.test.ts`: client address resolution; spoofed `X-Forwarded-For` ignored without a trusted proxy, right-most untrusted address behind one.
- Scripts: `scripts/backup/crypto.test.ts`: streamed backup encryption round trip, single-byte tampering, files moved between backup sets, wrong key.
- API routes and helpers: `apps/admin/app/api/admin/personnel/[id]/route.test.ts`, `apps/admin/app/api/admin/reports/[id]/route.test.ts`, `apps/admin/app/api/platform/organizations/[id]/route.test.ts`, `apps/admin/app/platform/_components/platform-client.test.ts`, `apps/admin/lib/organization-branding.test.ts`, `apps/admin/lib/organization-deletion.test.ts`.
- Packages: `packages/data-client/src/builder.test.ts`, `packages/payments/src/index.test.ts`, `packages/shared/src/*.test.ts` (excel, permissions, rate limit, report number, subscription), `packages/validation/src/*.test.ts` (forms, customer signature, organization management).

## Database Tests (`pnpm db:test`)

`scripts/db/test.ts` resets the test database, applies all migrations, installs pgTAP into the `extensions` schema, and runs each `db/tests/*.test.sql` file in its own transaction that is rolled back. Pass a name fragment to run a subset, for example `pnpm db:test tenant`.

Suites:

- `tenant_isolation.test.sql`: cross-tenant reads and writes on every tenant table.
- `subscription_access.test.sql`: read/write/blocked access modes and restrictive policies.
- `customer_report_signatures.test.sql`: signature validation, signed report immutability, storage object protection, history-preserving profile deletion.
- `platform_admin.test.sql`: platform administrator checks and platform RPCs.
- `platform_organization_management.test.sql`: organization reopen and deletion manifests.
- `payment_events.test.sql`: verified payment event processing.
- `rate_limits.test.sql`: rate limit bucket privileges, allow/deny at the limit, window expiry, reset, and runtime denial for request roles.

Tests switch users with `set local role authenticated` and `select set_config('app.user_id', '<uuid>', true)`, the same context the server sets. They run as `ops_owner`, which may switch into the request roles without inheriting their privileges. pgTAP must be present in the PostgreSQL `share/extension` directory (`pgtap.control` and `pgtap--1.3.4.sql`).

## End-to-End Tests (`pnpm test:e2e`)

`scripts/e2e/local-stack.ts` uses the same endpoints, cookies, and `@operations/data-client` builder as the browser. Each run creates a new throwaway tenant B and test records for the tenant of `E2E_ADMIN_EMAIL`. Sections:

- authentication and session: anonymous access, platform owner login, cookie attributes, wrong password, cross-origin login;
- platform management: dashboard, registration of tenant B, lifetime access and activation;
- organization admin: access mode, companies, lines, belts, vehicles, equipment, personnel account;
- field report: personnel login, RLS on company inserts, draft upsert, report personnel, photo upload, forged image and foreign-path rejection, signed and tampered links, signed submission and report number, immutability after signing;
- admin review: embedded relations, PDF, Excel export;
- tenant isolation between A and B, including PDFs and signed links;
- gateway hardening: allowlist, schema, injection, unfiltered delete, row limit, cross-origin cookie writes, web token used as bearer;
- mobile bearer login and logout, server-side revocation of an old cookie.

Accounts: create the platform owner with `pnpm create-admin --platform`, register the organization admin through `/register` and activate it in `/platform`, and let the suite create the personnel account. The login rate limit (10 per minute per client) means the suite should not be run more than once per minute. Rate limit counters are stored in the database and survive restarts; if manual testing filled them, clear them with `pnpm db:psql -c "delete from private.rate_limit_buckets"`.

## Backup Restore Drill

`pnpm backup:verify` restores the newest encrypted backup into `operations_portal_test` and compares row counts and migrations with the backup manifest. Run it after `pnpm backup` and before migrations; afterwards `pnpm db:test` rebuilds the test database as usual.

## What Requires Tests

Add or update tests when changing:

- shared validation schemas, permission or role logic, report numbering, subscription access, payment helpers, Excel export;
- the data gateway, compiler, allowlist, session, cookie, CSRF, storage, encryption, or client address code (`apps/admin/lib/server`, `apps/admin/lib/client-address.mjs`);
- backup format or encryption (`scripts/backup`);
- migrations, RLS policies, grants, triggers, or deletion and history-preservation behavior (`db/tests`);
- any new API route that reads or writes tenant data (unit test for the guard path plus an end-to-end check).

## Manual Verification

Check affected flows in the browser with the console and network panel open: login and registration, platform panel, personnel account creation, reset, and deletion, master data management, assignments, report creation, submission, detail, deletion, PDF and Excel export, and organization branding.

## Recommended Order

1. `pnpm run typecheck`
2. `pnpm run test`
3. `pnpm run lint`
4. `pnpm db:test` when migrations, policies, or triggers changed
5. `pnpm test:e2e` with `pnpm dev:admin` running
6. `pnpm run build` for release-sensitive changes
7. Manual browser or mobile verification of changed flows
