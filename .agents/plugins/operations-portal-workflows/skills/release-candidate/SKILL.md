---
name: release-candidate
description: Use for deciding whether the current repository or branch is ready to release without deploying automatically.
---

# Release Candidate

Use this workflow as a release-readiness gate for the current repository or branch. This workflow must not deploy. Do not use unsupported nested-skill syntax; read relevant sibling `SKILL.md` files as procedural sources and apply their phases.

## Workflow Sources

Always read:

- `AGENTS.md`
- `docs/TESTING.md`
- `docs/DEPLOYMENT.md`
- `../production-release/SKILL.md`
- `../code-review/SKILL.md`

Read additional sources when relevant:

- `docs/SECURITY.md` and `../security-review/SKILL.md` for security-sensitive changes
- `docs/DATABASE.md` and `../database-migration/SKILL.md` for Supabase, schema, RLS, storage, migration, or database access changes
- `../performance-review/SKILL.md` for changed performance-sensitive areas

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

1. Repository state: inspect git status, final diff or relevant commit range, uncommitted files, untracked files, and unrelated changes.
2. Code review: apply code-review principles with focus on correctness, regressions, error handling, deleted safeguards, changed callers, incomplete work, and test coverage.
3. Security: apply security-review principles where relevant, especially authn, authz, tenant isolation, RLS, server-only secrets, API exposure, storage, exports, and sensitive data.
4. Database and deployment: inspect new Supabase migrations, RLS changes, schema compatibility, migration ordering, environment variable changes, backwards compatibility, rollout ordering, and rollback or mitigation concerns.
5. Performance: apply performance-review only to changed performance-sensitive areas. Do not report speculative micro-optimizations.
6. Verification gate: use `docs/TESTING.md` and `docs/DEPLOYMENT.md` to run appropriate typecheck, lint, tests, production build, migration checks, and targeted smoke checks.
7. Failure classification: differentiate failures caused by current changes, pre-existing failures, and unverified areas. Do not hide existing failures.
8. Release verdict: return exactly one of `READY`, `READY WITH WARNINGS`, or `NOT READY`, followed by blocking findings, important warnings, verification executed, migration requirements, environment changes, rollback concerns, manual checks, and release recommendation.

Return `NOT READY` when unresolved blocking findings remain.
