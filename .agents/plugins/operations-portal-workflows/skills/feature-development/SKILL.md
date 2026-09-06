---
name: feature-development
description: Use for implementing a scoped feature in this repository from impact analysis through verification.
---

# Feature Development

Use this workflow for non-trivial feature work in `operations-portal`.

## Project References

Read the relevant sections before editing:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/DATABASE.md` when data shape, RLS, storage, or migrations are involved
- `docs/TESTING.md`
- `docs/DEPLOYMENT.md` when build or release behavior may be affected

## Workflow

1. Do impact analysis before implementation. Identify affected UI, API routes, Supabase/database objects, shared packages, scripts, tests, and user flows.
2. Define acceptance criteria from the request and discovered behavior. Keep assumptions explicit when the repo cannot answer them.
3. Inspect existing implementation, callers, shared helpers, authorization checks, data flow, and nearby tests before editing.
4. Plan the smallest scoped change, including tenant isolation, server-only secrets, migration needs, regression-sensitive paths, and verification commands.
5. Implement incrementally using existing project patterns. Put reusable business logic in `packages/*` when it is shared by apps, scripts, or tests.
6. Preserve organization/company isolation and Supabase RLS. Do not rely on client-side checks as the only boundary.
7. Add or update focused tests for changed behavior where the current test structure supports it.
8. Verify the acceptance criteria and affected regression-sensitive paths. Start with narrow checks, then run typecheck, lint, tests, or build as risk requires.
9. Review the final git diff for unrelated changes, missed callers, security regressions, and source-of-truth conflicts.
10. Report what changed, acceptance status, commands actually run, failures, skipped checks, assumptions, and remaining risks.

Do not claim tests passed unless they were executed successfully.
