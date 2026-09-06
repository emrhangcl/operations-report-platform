# Security

## Authentication Model

Authentication uses Supabase Auth. Client apps authenticate with public Supabase configuration values. Server routes receive bearer tokens and validate them with Supabase Auth before performing privileged operations.

Verified auth-related code:

- `apps/admin/lib/supabase-server.ts`
- `apps/admin/lib/supabase-browser.ts`
- `apps/admin/app/api/auth/register/route.ts`
- `apps/admin/app/api/admin/personnel/create-account/route.ts`
- `apps/admin/app/api/admin/personnel/reset-password/route.ts`

## Authorization Model

Server authorization helpers in `apps/admin/lib/supabase-server.ts` provide:

- platform admin checks through `requirePlatformAdmin`
- active organization profile checks through `requireActiveProfile`
- organization admin checks through `requireAdmin`

These helpers validate the session token, load user access context through Supabase RPC, check active profile and membership state, enforce organization status, and gate write access by subscription access mode.

## Tenant and Company Isolation

Tenant ownership is organization-based. Current migrations add and enforce `organization_id` on core tables and policies. Agents must preserve organization filtering on all user, company, line, vehicle, belt, equipment, assignment, report, photo, export, logo, payment, and subscription paths.

Company-level filtering exists within organization data, for example company lines and reports linked to companies. Company isolation must not replace organization isolation.

## Supabase RLS

Migrations enable RLS on verified public tables including `profiles`, `organizations`, `organization_members`, `companies`, `company_lines`, `vehicles`, `belts`, `equipment`, `reports`, report child tables, `installation_assignments`, billing tables, and `audit_logs`.

Recent tenant policies use private helper functions such as `private.current_organization_id()`, `private.is_admin()`, and `private.is_organization_member(...)`. Do not bypass RLS in client code.

## Server-Only Secrets

Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser or mobile code. It is used by server utilities and administrative scripts only. Public client values are represented by `NEXT_PUBLIC_SUPABASE_*` and `EXPO_PUBLIC_SUPABASE_*`.

## Storage Access

Migrations create and protect a private `report-photos` bucket. Report deletion code removes related storage objects before deleting report records. Organization logo storage is referenced by branding routes and helpers. Exact bucket policy details for every logo path are Not yet documented.

## API Security

Verified API patterns include JSON body size checks, process-local rate limits, bearer token validation, organization filtering, audit logs, and generic error responses for sensitive operations. Next.js config sets security headers including CSP, `X-Frame-Options`, `X-Content-Type-Options`, Referrer Policy, Permissions Policy, and related cross-origin headers.

## Security Invariants

- Enforce authorization server-side and/or through Supabase RLS.
- Never trust client-side role checks as the only boundary.
- Never return cross-organization data from APIs, exports, PDFs, logs, or signed storage URLs.
- Keep service-role operations scoped by verified organization context.
- Add or update RLS whenever schema or access paths change.
- Do not log secrets, tokens, passwords, or full sensitive payloads.
