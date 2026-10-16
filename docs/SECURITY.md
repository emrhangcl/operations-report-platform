# Security

Security is layered so that a mistake in one layer is caught by the next. The browser and mobile app never talk to PostgreSQL directly; every request passes the HTTP layer, session authentication, route guards or the data gateway, and finally PostgreSQL roles, RLS, and triggers.

## Layers at a Glance

1. **Network**: PostgreSQL listens on `127.0.0.1` only; `pg_hba.conf` allows only loopback hosts with `scram-sha-256`. The dev server binds to localhost; production must sit behind an HTTPS reverse proxy (see `docs/self-hosting.md`).
2. **HTTP**: security headers from `apps/admin/next.config.mjs`, request IDs and HSTS (on HTTPS) from `middleware.ts`, JSON body size limits (`lib/request-body.ts`), and rate limits (`lib/rate-limit.ts`).
3. **Session authentication**: `lib/server/auth/*`.
4. **CSRF**: origin checks plus the `X-Auth-Scope` header for cookie sessions.
5. **Route guards**: `lib/server/guards.ts` for API routes.
6. **Data gateway**: `/api/data` validation and allowlist (`lib/server/query/*`).
7. **Database roles**: `ops_app` has no privileges; each transaction switches to `anon`, `authenticated`, or `service_role`.
8. **RLS, constraints, and triggers**: tenant isolation, subscription access, signed report immutability.
9. **File storage**: storage RLS, content validation, path safety, signed links.
10. **Audit and security events**: `public.audit_logs` for business actions, `auth.security_events` for authentication events.

## Authentication

Implemented in `apps/admin/lib/server/auth`:

- **Passwords** (`password.ts`): scrypt with `N=32768, r=8, p=1`, 16-byte random salt, 64-byte key, NFKC normalization, 256-character maximum. Format `scrypt$N$r$p$salt$hash`. Comparison is constant-time; unknown emails are checked against a dummy hash so response time does not reveal registered accounts. Outdated parameters are rehashed on the next successful login.
- **Sessions** (`sessions.ts`): 256-bit random tokens; only the SHA-256 hash is stored in `auth.sessions` together with scope (`admin`/`personnel`), client (`web`/`mobile`), IP, and user agent. Defaults: admin sessions expire after 7 days or 24 hours idle, personnel sessions after 30 days or 7 days idle (`AUTH_*_SESSION_*_HOURS`). Expired, idle, or banned sessions are revoked when presented. Logout, password reset, and password changes revoke sessions server-side.
- **Login protection** (`flows.ts`): 10 login attempts per minute per client address, account lock after 8 consecutive failures for 15 minutes (`AUTH_MAX_FAILED_LOGINS`, `AUTH_LOCK_MINUTES`). Wrong password and locked account return the same message. Successful, failed, blocked, and denied logins are written to `auth.security_events`.
- **Scope decision**: the server, not the browser, decides whether a login becomes an admin, personnel, or platform owner session and where to redirect.
- **Password reset and email verification**: one-time tokens (60 minutes and 48 hours), stored hashed in `auth.one_time_tokens`, consumed atomically, previous unused tokens invalidated. Reset requests answer identically whether or not the account exists. Links are written to the local mail outbox; the reset page removes the token from the address bar.
- **Web transport** (`http.ts`): httpOnly, `SameSite=Strict` cookies per scope (`ops_admin_session`, `ops_personnel_session`; `__Host-` prefix and `Secure` when `APP_URL` is HTTPS). A cookie is only read when the request names its scope in `X-Auth-Scope`, and a cookie of one scope never authenticates the other.
- **Mobile transport**: `Authorization: Bearer <token>` is accepted only for sessions created with `client: "mobile"`; a web session token cannot be replayed as a bearer token. The Expo app stores the token in `expo-secure-store`.

## CSRF

State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) authenticated by cookie must come from `APP_URL` or the request's own origin, verified through `Origin`, then `Sec-Fetch-Site`, then `Referer`; requests without any of them are rejected. The required custom `X-Auth-Scope` header forces a CORS preflight for cross-site scripts, and `SameSite=Strict` keeps cookies off cross-site requests. The web login and registration endpoints also require a same-origin request.

## Authorization

Route guards (`lib/server/guards.ts`):

- `requirePlatformAdmin`: session plus a row in `private.platform_admins`.
- `requireActiveProfile`: active profile, active membership, active organization, and a subscription access mode of `read` or `write` (`write` when the route mutates).
- `requireAdmin`: `requireActiveProfile` plus role `OWNER` or `ADMIN`.

Failures return `401` (no or expired session), `403` (access denied), or `503` (server misconfiguration). Routes that use the service client must still filter every query by the verified `organizationId`.

## Data Gateway

`POST /api/data` (`app/api/data/route.ts`) is the only way client code reads or writes tables:

- The request is a structured `QuerySpec` (no SQL), validated by Zod: identifier patterns, at most 50 filters, 10 orderings, 500 rows per write, a 1 MB body, and no unknown keys.
- A table/action allowlist (`gateway-policy.ts`) rejects everything else before the database is touched. Anonymous requests may only read `plans`.
- Identifiers are checked against the live PostgreSQL catalog and quoted; every value is a typed bind parameter. Embedded relations are resolved from foreign keys.
- Selects are capped at 1000 rows (`DATA_MAX_ROWS`). Updates and deletes without a filter are refused.
- Queries run as `authenticated` (or `anon`) with `app.user_id` set, so RLS applies. Internal database errors reach the client only as a generic message; constraint, permission, and trigger messages (SQLSTATE classes 22, 23, P0, and 42501) are passed through, and unexpected errors are logged on the server.

## Database Roles and RLS

See `docs/DATABASE.md` for the role table. Key invariants:

- `ops_app` is `NOINHERIT` and owns nothing; if a code path forgets to switch roles it cannot read data.
- `service_role` (`BYPASSRLS`) is only reachable from server code after a guard succeeded.
- RLS is enabled on all `public` tables and on `auth` and `storage` tables. `auth` tables are granted to `service_role` only.
- Tenant policies use `private.current_organization_id()`, `private.is_admin()`, and `private.is_organization_member(...)`. Restrictive `subscription_*_access` policies enforce the subscription access mode.
- Triggers assign `organization_id`, creator snapshots, and report numbers on the server, reject cross-tenant references, and keep signed reports immutable.

## Tenant and Company Isolation

Tenant ownership is organization-based. Preserve organization filtering on all user, company, line, vehicle, belt, equipment, assignment, report, photo, export, logo, payment, and subscription paths. Company-level filtering exists inside organization data and never replaces organization isolation. Cross-tenant access attempts are covered by `db/tests/tenant_isolation.test.sql` and the tenant isolation section of `pnpm test:e2e`.

## File Storage

- Buckets `report-photos` (5 MB) and `organization-logos` (2 MB) are private and accept JPEG, PNG, and WebP.
- Uploads are authorized by inserting the metadata row in the caller's database context; storage RLS requires `<organization_id>/<report_id>/<file>` paths for reports the user may access. The file is moved into place only after that transaction commits.
- The declared content type must match the file's magic bytes; executables or SVG disguised as images are rejected.
- Object names allow only `[A-Za-z0-9._-]` segments (at most 8) and must resolve inside the bucket directory; `..`, absolute paths, backslashes, and control characters are rejected.
- Downloads use links signed with HMAC-SHA256 over bucket, path, and expiry (`AUTH_SECRET`, at most 7 days). Responses carry `nosniff`, `Content-Disposition: inline`, and a sandboxing CSP. A signed link is only issued for objects the caller can see through RLS.

## Server-Only Secrets

`DATABASE_URL`, `DATABASE_MIGRATION_URL`, `TEST_DATABASE_*`, `AUTH_SECRET`, and payment provider keys are server-only. They live in the repository root `.env`, which Git ignores, and are never exposed through `NEXT_PUBLIC_*` or `EXPO_PUBLIC_*` variables. The only public client setting is `EXPO_PUBLIC_API_URL`. The PostgreSQL superuser password is stored in `OPS_DATA_DIR/secrets` and is used only by the bootstrap script.

## API Security

Patterns used by API routes: JSON body size checks, rate limits, session and guard checks, organization filtering, audit logs, request IDs, and generic error responses for sensitive operations. `next.config.mjs` sets a CSP (`default-src 'self'`, no third-party origins, `frame-ancestors 'none'`, `upgrade-insecure-requests` when served over HTTPS), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Referrer Policy, Permissions Policy, and cross-origin isolation headers.

## Known Limitations

These are deliberate next steps for the protection work, not hidden behavior:

- Rate limits are kept in process memory: they reset on restart and are per instance. The client address comes from `X-Forwarded-For` / `X-Real-IP`, which a client can spoof unless a trusted reverse proxy overwrites them.
- The CSP still allows `'unsafe-inline'` scripts and styles.
- Local HTTP has no TLS; cookies are `Secure` only when `APP_URL` is HTTPS.
- Password reset and verification links are stored in plain `.eml` files in the local mail outbox until an SMTP provider is connected.
- There is no automated backup, no encryption at rest for `OPS_DATA_DIR`, and no centralized log collection yet.
- Multi-factor authentication is not implemented.

## Security Invariants

- Enforce authorization server-side and through PostgreSQL RLS; never rely on client-side role checks alone.
- Never return cross-organization data from APIs, exports, PDFs, logs, or signed storage URLs.
- Keep service-role operations scoped by a verified organization context.
- Add or update grants and RLS whenever schema or access paths change, and extend `db/tests`.
- Do not log secrets, tokens, passwords, signed URLs, or full sensitive payloads.
