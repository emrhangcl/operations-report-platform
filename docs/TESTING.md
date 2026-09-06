# Testing

## Existing Test Framework

The repository uses Vitest for package-level unit tests. The root `package.json` exposes `pnpm run test`, which runs workspace test scripts when present.

Verified package test scripts:

- `@operations/validation`: `vitest run`
- `@operations/shared`: `vitest run`
- `@operations/payments`: `vitest run`

`@operations/types`, `@operations/admin`, and `@operations/mobile` currently expose typecheck/build/lint scripts but no package-level test script.

## Current Test Locations

Verified test files:

- `packages/validation/src/index.test.ts`
- `packages/shared/src/subscription.test.ts`
- `packages/shared/src/report-number.test.ts`
- `packages/shared/src/rate-limit.test.ts`
- `packages/shared/src/permissions.test.ts`
- `packages/shared/src/excel.test.ts`
- `packages/payments/src/index.test.ts`

Supabase database tests are stored under `supabase/tests/`. Exact test file coverage is Not yet documented here.

## Commands

Run from the repository root:

```bash
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
```

`pnpm run typecheck` runs TypeScript checks across workspaces with typecheck scripts. `pnpm run lint` runs available lint scripts, including admin ESLint. `pnpm run test` runs available Vitest package tests. `pnpm run build` builds the admin app and typechecks the mobile app.

## What Requires Tests

Add or update tests when changing:

- shared validation schemas
- permission or role logic
- tenant/organization isolation helpers
- rate limiting
- report numbering
- subscription access behavior
- payment provider helpers
- Excel export logic
- deletion behavior and history preservation

For API, UI, PDF, and Supabase policy changes, add automated tests where the current structure supports them. If not, document manual verification clearly.

## Manual Verification Expectations

Manually verify affected flows:

- login and registration
- owner/platform access
- personnel account creation, reset, and deletion
- company, line, vehicle, belt, and equipment management
- assignment creation and completion
- report creation, submission, detail view, deletion, PDF, and Excel export
- organization branding and file access when changed

For UI work, check browser console and network errors.

## Recommended Verification Order

1. `pnpm run typecheck`
2. Relevant package tests or `pnpm run test`
3. `pnpm run lint`
4. `pnpm run build` for deployment-sensitive changes
5. Manual browser/mobile verification for changed user flows
6. Supabase database tests when migrations or RLS change
