# Architecture

## Monorepo Layout

This repository is the private pnpm workspace `operations-portal`. Workspace members are declared in `pnpm-workspace.yaml` as:

- `apps/*`
- `packages/*`

Main applications:

- `apps/admin`: Next.js App Router web portal.
- `apps/mobile`: Expo / React Native app for mobile workflows.

Shared packages:

- `packages/types`: shared TypeScript types.
- `packages/validation`: shared Zod validation schemas.
- `packages/shared`: shared utilities for permissions, rate limits, dates, Excel, subscriptions, and report numbers.
- `packages/payments`: payment provider abstractions and tests.

## Apps and Shared Packages

`apps/admin` depends on all shared packages and contains public pages, authenticated portal routes, platform owner routes, API routes, PDF generation, Supabase clients, and UI components. `apps/mobile` depends on `@operations/types` and `@operations/validation`, plus Supabase and Expo libraries.

Business logic that is reused by web, mobile, scripts, or tests should live in `packages/*`. App-specific UI and route handling should stay inside the relevant app.

## Important Data Flows

- Registration posts to `apps/admin/app/api/auth/register/route.ts`, validates with `organizationRegistrationSchema`, creates a Supabase Auth user, organization, profile, membership, subscription, and audit log.
- Personnel/admin account creation uses `apps/admin/app/api/admin/personnel/create-account/route.ts` and Supabase service-role admin APIs.
- Report PDF generation uses `apps/admin/app/api/reports/[id]/pdf/route.ts` and `apps/admin/lib/report-pdf.ts`.
- Report export uses `apps/admin/app/api/admin/reports/export/route.ts` and `packages/shared`.
- Report deletion unlinks assignments, removes report photo storage objects, deletes child rows, then deletes the report.

## Authentication and Authorization

Authentication is Supabase Auth. Server API routes validate bearer tokens with Supabase Auth before using service-role access. Organization access is resolved through server helpers in `apps/admin/lib/supabase-server.ts`, including platform admin checks, active profile checks, organization membership, subscription access mode, and admin/personnel role handling.

Browser Supabase clients use separate storage keys for admin and personnel scopes in `apps/admin/lib/supabase-browser.ts`.

## Admin and Mobile Relationship

The admin web app is the primary portal for owner, admin, manager, personnel, reports, assignments, organizations, plans, and platform routes. The Expo app exists for mobile workflows and local/mobile testing. Current production mobile-web/PWA strategy is documented elsewhere; exact rollout ownership is Not yet documented in this file.

## External Services

Verified external services and libraries:

- Supabase for Auth, Postgres, and Storage.
- Vercel Analytics and Speed Insights packages in the admin app.
- Expo for the mobile app.
- pdfmake for PDF generation.
- ExcelJS for Excel export.

Payment providers are represented in code by iyzico and PayTR provider modules. Operational production payment setup is Not yet documented.
