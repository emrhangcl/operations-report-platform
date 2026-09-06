# Deployment

## Verified Build Commands

Root scripts in `package.json` define the supported build checks:

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

`pnpm run build` runs:

```bash
pnpm --filter @operations/admin build && pnpm --filter @operations/mobile typecheck
```

The admin package build command is `next build`. The mobile package has Expo start commands and a TypeScript check, but no verified production mobile deployment script.

## Environment Requirements

`.env.example` documents these environment variables:

- `APP_ENV`
- `APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS`
- `PAYMENT_PROVIDER`
- `IYZICO_API_KEY`
- `IYZICO_SECRET_KEY`
- `IYZICO_MERCHANT_ID`
- `PAYTR_MERCHANT_ID`
- `PAYTR_MERCHANT_KEY`
- `PAYTR_MERCHANT_SALT`

`APP_URL` is required by registration origin logic in production. `SUPABASE_SERVICE_ROLE_KEY` is server-only and must be provided at runtime, not exposed to browser or mobile bundles.

## Deployment-Related Configuration

Verified files:

- `Dockerfile`
- `compose.yaml`
- `apps/admin/next.config.mjs`
- `.vercelignore`
- `.dockerignore`

The Dockerfile builds a standalone Next.js admin app with Node 22, removes source maps and TypeScript build info from the final image, runs as non-root `nextjs`, exposes port `3000`, and defines a healthcheck for `/api/health`.

`compose.yaml` builds the web service, binds container port `3000` to `127.0.0.1:3000`, sets required Supabase and app environment variables, enables read-only filesystem, drops Linux capabilities, sets `no-new-privileges`, and configures tmpfs for writable temporary/cache paths.

`apps/admin/next.config.mjs` configures public environment injection, security headers, Supabase image remote patterns, package transpilation, optional standalone output, and optional Vercel analytics support.

## Database Migration Expectations

Database, RLS, storage, trigger, and function changes must be delivered as new SQL files under `supabase/migrations`. Running migrations in production is not automated by a verified script in this repository. Not yet documented: the exact production migration command, operator, approval process, and rollback procedure.

## Pre-Deployment Checks

Before deployment-related handoff:

1. Run `pnpm install` if dependencies changed.
2. Run `pnpm run typecheck`.
3. Run `pnpm run lint`.
4. Run `pnpm run test`.
5. Run `pnpm run build`.
6. Confirm required environment variables are set in the target platform.
7. Confirm new Supabase migrations have been reviewed and applied through the documented operational process.
8. Smoke test `/api/health` after deployment.

## Not Yet Documented

- Exact Vercel project settings and deployment ownership.
- Exact production Supabase migration workflow.
- Mobile app store or EAS deployment process.
- Payment provider production onboarding and callback configuration.
