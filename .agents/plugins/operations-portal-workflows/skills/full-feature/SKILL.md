---
name: full-feature
description: Use for safely delivering a non-trivial feature from impact analysis through implementation, specialist review, verification, and final report.
---

# Full Feature

Use this workflow for non-trivial feature work that needs orchestration across implementation, review, and verification. Do not use unsupported nested-skill syntax; read relevant sibling `SKILL.md` files as procedural sources and apply their phases.

## Workflow Sources

Always read:

- `AGENTS.md`
- relevant `docs/*`
- `../architecture-review/SKILL.md`
- `../feature-development/SKILL.md`
- `../code-review/SKILL.md`

Read specialist sources only when relevant:

- `../security-review/SKILL.md` for auth, users, organizations, companies, tenant data, RLS, APIs, storage, secrets, exports, PDFs, or permissions
- `../database-migration/SKILL.md` for schema, policies, indexes, foreign keys, migrations, or database access-pattern changes
- `../ui-review/SKILL.md` for UI behavior changes
- `../performance-review/SKILL.md` for large queries, exports, PDF generation, lists/tables at scale, repeated API/database calls, or expensive rendering

## Orchestration Rules

- Treat `AGENTS.md` as authoritative for repository rules and `docs/*` as authoritative for project-specific technical information.
- Use sibling specialist skills as the detailed workflow source, but apply only relevant specialist phases.
- Prefer evidence over assumptions. Keep final reports concise and decision-oriented.
- Never use destructive git or database operations without explicit approval.
- Never deploy automatically.
- Never weaken tenant isolation or RLS to make a task pass.
- Never ignore failing verification caused by the change.
- Do not mark work complete with unresolved blocking findings.

## Workflow

1. Architecture and impact: understand the request, define acceptance criteria, map affected `apps/admin`, `apps/mobile`, `packages/*`, APIs, Supabase/database, storage, external integrations, security impact, tenant isolation, migrations, and backwards-compatibility risk.
2. Stop and report if the request is too ambiguous to implement safely or if a required product decision cannot be inferred from the repository.
3. Implementation: produce a concise plan, implement incrementally, keep changes scoped, reuse shared packages, preserve existing behavior outside the feature, and add or update tests when behavior changes.
4. Specialist review: apply only relevant security, database, UI, or performance phases. Do not run specialist reviews just because they exist.
5. Final code review: inspect the final git diff for regressions, missed callers, neighboring behavior, unrelated edits, and blocking findings versus suggestions.
6. Verification: run repository checks according to `docs/TESTING.md`; for substantial app changes consider `pnpm run typecheck`, `pnpm run lint`, relevant tests, and build when appropriate.
7. Final report: summarize feature delivered, acceptance criteria status, files changed, database or migration changes, security considerations, checks executed, review findings resolved, remaining risks, and manual verification still needed.

Never claim a command passed unless it actually executed successfully.
