---
name: architecture-review
description: Use for reviewing this repository's architecture, dependencies, boundaries, and data flow without automatically modifying code.
---

# Architecture Review

Use this workflow for architecture reviews, boundary checks, dependency assessments, and data-flow reviews. Do not modify code unless the user explicitly asks for fixes.

## Project References

Read:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md` when auth, tenant isolation, storage, or sensitive data paths are involved
- `docs/DATABASE.md` when Supabase, schema, RLS, storage policies, or migrations are involved
- `docs/TESTING.md` for verification context
- `docs/DEPLOYMENT.md` when runtime, build, or release behavior may be affected

## Workflow

1. Identify the review scope, affected product flows, and architectural question being answered.
2. Inspect affected code, imports, callers, dependencies, API routes, Supabase paths, and external service integrations before judging.
3. Map impact across `apps/admin`, `apps/mobile`, `packages/*`, APIs, Supabase, scripts, and external services.
4. Identify ownership boundaries and layering. Check whether shared business logic belongs in `packages/*` instead of app-specific code.
5. Detect duplicated business logic, drift between web/mobile behavior, and repeated validation or permission rules.
6. Review coupling, data flow, backwards compatibility, dependency direction, and migration or rollout implications.
7. Separate findings into blocking architectural issues, technical debt, and optional improvements.
8. Include evidence and file locations for every finding. Keep assumptions separate from confirmed facts.
9. Do not recommend broad rewrites unless the concrete benefit, risk reduction, or maintenance payoff is clear.
10. Report findings, boundaries checked, skipped areas, and remaining architectural risks.
