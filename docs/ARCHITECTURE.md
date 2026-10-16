# Architecture

The platform runs entirely on infrastructure the operator controls: a Next.js server and a PostgreSQL 18 database. There is no backend-as-a-service, hosted auth provider, or hosting-platform dependency. The browser and the mobile app never connect to the database directly; every request goes through the Next.js server, which enforces authentication and then lets PostgreSQL enforce row-level security.

```text
Browser (web, PWA)  ─┐  httpOnly session cookie + X-Auth-Scope
Expo mobile app     ─┤  Bearer session token (mobile sessions only)
                     ▼
Next.js server (apps/admin)
  ├─ app/api/auth/*        login, logout, session, password reset, email verification
  ├─ app/api/data          validated data gateway (QuerySpec -> parameterized SQL)
  ├─ app/api/storage/*     upload, signed links, deletion
  └─ app/api/admin|platform|reports|account|payments/*   domain endpoints
                     ▼  ops_app login, SET LOCAL ROLE + app.user_id per transaction
PostgreSQL 18 (local)
  ├─ public / private      application schema, RLS policies, triggers, RPCs
  ├─ auth                  users, sessions, one-time tokens, security events
  ├─ storage               buckets and object metadata (file bytes live on disk)
  └─ migrations            applied migration ledger with checksums
```

## Monorepo Layout

This repository is the private pnpm workspace `operations-portal`. Workspace members are declared in `pnpm-workspace.yaml` as `apps/*` and `packages/*`.

Applications:

- `apps/admin`: Next.js App Router web portal (public site, organization panel, personnel screen, platform owner panel) and the entire server/API layer.
- `apps/mobile`: Expo / React Native app for field personnel. It talks to the same API with bearer tokens.

Shared packages:

- `packages/data-client`: query builder (`from().select().eq()...`) shared by the browser, the server, and the mobile app. It only produces a structured `QuerySpec`; it never builds SQL.
- `packages/types`: shared TypeScript types.
- `packages/validation`: shared Zod validation schemas.
- `packages/shared`: permissions, rate limiting, dates, Excel export, subscription access, and report numbering.
- `packages/payments`: payment provider abstractions (iyzico, PayTR).

Database and tooling:

- `db/migrations`: append-only SQL migrations (`0001` platform foundation, `0002` consolidated application schema, later files are changes).
- `db/tests`: pgTAP database security tests.
- `scripts/local`: local PostgreSQL lifecycle (`postgres.mjs`) and one-command setup (`setup.mjs`).
- `scripts/db`: migration runner (`migrate.ts`) and pgTAP test runner (`test.ts`).
- `scripts/e2e`: end-to-end test against a running app (`local-stack.ts`).
- `scripts/create-admin.ts`: creates the first platform owner or an organization admin.

Business logic reused by web, mobile, scripts, or tests belongs in `packages/*`. Route handling and UI stay inside the relevant app.

## Server Layer (`apps/admin/lib/server`)

- `config.ts`: reads and validates server configuration (`DATABASE_URL`, `APP_URL`, `AUTH_SECRET`, data directories, session and lockout settings). Values come from the process environment or the repository root `.env`.
- `db.ts`: PostgreSQL pool and `withDbContext()`. Every unit of work runs in one transaction that first executes `SET LOCAL ROLE anon | authenticated | service_role` and `set_config('app.user_id', <uuid>, true)`. `auth.uid()` reads that setting, so RLS policies see the authenticated user.
- `auth/`: password hashing (`password.ts`), token generation and HMAC signing (`tokens.ts`), session storage (`sessions.ts`), cookie/bearer handling and CSRF origin checks (`http.ts`), account operations (`users.ts`), and login / reset / verification flows (`flows.ts`).
- `query/`: catalog introspection (`catalog.ts`), `QuerySpec` to SQL compilation (`compiler.ts`), execution and error mapping (`execute.ts`), named-argument RPC calls (`rpc.ts`), and the client gateway allowlist plus request schema (`gateway-policy.ts`).
- `storage.ts`: local file storage. Metadata rows in `storage.objects` are written in the caller's database context, so storage RLS policies authorize every upload, read, and delete before the file on disk is touched.
- `service-client.ts`: `createServiceClient()` returns `from()`, `rpc()`, `storage`, and `auth.admin.deleteUser()` running as `service_role`; `createUserClient(userId)` returns the same API bound to RLS.
- `guards.ts`: `requirePlatformAdmin`, `requireAdmin`, and `requireActiveProfile` for API routes. Failures always carry an HTTP status (`401` missing or expired session, `403` insufficient access, `503` misconfiguration).
- `mailer.ts`: writes outgoing mail as `.eml` files to the local outbox instead of sending it.

Browser-side counterparts live in `apps/admin/lib/browser-client.ts` (`getBrowserClient(scope)`, `scopeHeaders(scope)`, read cache) and `apps/admin/lib/account-context-client.ts`.

## Important Data Flows

- **Login**: `POST /api/auth/login` verifies the password, checks lockout, decides the scope and destination on the server (platform owner `/platform`, personnel `/personel`, organization admin `/app` or `/subscription`), creates a session row, and sets the scope's httpOnly cookie. Mobile clients send `client: "mobile"` and receive the token in the response body instead.
- **Data access**: browser and mobile code build a `QuerySpec` with `@operations/data-client` and post it to `/api/data`. The server validates the spec, resolves the session, applies the table/action allowlist, compiles parameterized SQL against the live catalog, and executes it as `authenticated` (or `anon` for public pricing data) under RLS.
- **Registration**: `POST /api/auth/register` creates the account, organization (`suspended`), profile, `OWNER` membership, pending subscription, audit log entry, and security event in one transaction.
- **Personnel accounts**: `POST /api/admin/personnel/create-account` creates the account, profile, membership, and audit entry in one transaction. Password resets issue a one-time link (`/reset-password?token=...`) that is returned to the admin and written to the mail outbox.
- **Reports**: personnel upsert a draft by `client_request_id`, add report personnel and photos, then switch the report to `SUBMITTED` together with the customer signature. Triggers assign the organization, creator snapshot, and the transaction-safe report number (`RPR-YYYY-NNNNNN`) and lock signed reports.
- **Files**: uploads go to `POST /api/storage/object/<bucket>/<path>` (organization/report path checked by storage RLS, content type checked against magic bytes). Display uses short-lived HMAC-signed links served by `GET /api/storage/object/...`.
- **PDF and Excel**: `GET /api/reports/[id]/pdf` (`lib/report-pdf.ts`, pdfmake) and `GET /api/admin/reports/export` (`packages/shared`, ExcelJS) read through the service client with explicit organization filters.
- **Organization deletion**: platform RPCs prepare a deletion manifest, purge tenant data transactionally, then the server removes stored files and login accounts, and finally deletes the organization (`lib/organization-deletion.ts`).

## Authentication and Authorization

Authentication is implemented in this repository (`apps/admin/lib/server/auth`). Web sessions are opaque random tokens stored only as SHA-256 hashes in `auth.sessions`; the browser holds them in httpOnly, `SameSite=Strict` cookies (`ops_admin_session`, `ops_personnel_session`, with the `__Host-` prefix when `APP_URL` uses HTTPS). Admin and personnel sessions can coexist in one browser; each request names its scope with the `X-Auth-Scope` header.

Authorization is layered: route guards check the session, active profile, organization membership, organization status, subscription access mode, and role; the data gateway restricts tables and actions; PostgreSQL RLS policies and triggers enforce tenant isolation and business rules for every query. See `docs/SECURITY.md`.

## Admin and Mobile Relationship

The admin web app is the primary product surface, including the personnel PWA at `/personel`. The Expo app (`apps/mobile`) is an optional field client. It reads `EXPO_PUBLIC_API_URL`, signs in with `client: "mobile"`, stores its session in `expo-secure-store`, and uses the same `/api/data` and `/api/storage` endpoints.

## External Services

The running system has no required external service. Optional or not-yet-connected integrations:

- Payment providers (iyzico, PayTR) through `packages/payments`; webhooks arrive at `/api/payments/webhooks/[provider]` once a provider is configured.
- Outgoing email: currently written to the local outbox (`OPS_DATA_DIR/mail-outbox`); an SMTP provider can replace `lib/server/mailer.ts` later.
- `next/font/google` downloads fonts at build time and serves them from the app afterwards; no font request reaches Google at runtime.
