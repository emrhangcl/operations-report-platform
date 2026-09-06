# Repository Guidelines

## Project Documentation

Before significant changes, consult the relevant project documentation:

- Architecture: `docs/ARCHITECTURE.md`
- Security: `docs/SECURITY.md`
- Database: `docs/DATABASE.md`
- Testing: `docs/TESTING.md`
- Deployment: `docs/DEPLOYMENT.md`

Use these documents as the project source of truth where relevant.

## Workflow Routing

`AGENTS.md` and `docs/*` remain the authoritative source of truth for this repository. Repository-specific architecture, security, database, testing, deployment, tenant-isolation, Supabase RLS, permissions, and business rules take precedence over generic workflow guidance.

oh-my-codex is the general orchestration layer. Use available OMX workflows when requirements clarification, deep analysis, research, planning, architecture discussion, durable checkpoints, complex multi-stage work, specialist coordination, long-running execution, verification, or QA materially improve the result. Relevant detected OMX invocations include `$oh-my-codex:deep-interview`, `$oh-my-codex:plan`, `$oh-my-codex:ralplan`, `$oh-my-codex:analyze`, `$oh-my-codex:ultragoal`, `$oh-my-codex:ultraqa`, `$oh-my-codex:autopilot`, and `$oh-my-codex:code-review`.

operations-portal-workflows provides repository-specific engineering procedures. Detected specialist invocations are `$operations-portal-workflows:architecture-review`, `$operations-portal-workflows:bug-fix`, `$operations-portal-workflows:code-review`, `$operations-portal-workflows:database-migration`, `$operations-portal-workflows:feature-development`, `$operations-portal-workflows:performance-review`, `$operations-portal-workflows:production-release`, `$operations-portal-workflows:security-review`, and `$operations-portal-workflows:ui-review`. Detected master workflow invocations are `$operations-portal-workflows:full-feature`, `$operations-portal-workflows:full-bug-fix`, and `$operations-portal-workflows:release-candidate`.

Choose one primary orchestration path for a task. For ordinary repository-specific feature work, prefer `$operations-portal-workflows:full-feature` when the task is clear and mainly implementation-focused; use OMX as primary when the task needs substantial clarification, research, architecture comparison, durable checkpoints, broad impact analysis, or complex coordination. For ordinary repository-specific bugs, prefer `$operations-portal-workflows:full-bug-fix` when the problem is scoped; use OMX analysis or planning when the bug is ambiguous, cross-cutting, difficult to reproduce, or needs deeper investigation. For release readiness, prefer `$operations-portal-workflows:release-candidate`; OMX QA or review may supplement it. Never deploy without explicit user instruction.

Select only workflows relevant to the actual change. Feature work may use `$operations-portal-workflows:feature-development`, plus architecture, security, database, UI, performance, and repository code review only when those concerns are touched. Bug work should establish evidence and root cause before edits, then add security, database, UI, performance, or architecture review only when the root cause or fix requires it. Release work should inspect git status and diff, migration and environment changes, and relevant tests, typecheck, lint, or build output; distinguish pre-existing failures from failures caused by the change.

When both plugins expose the same skill name, use the exact namespaced invocation. The detected collision is `code-review`: use `$operations-portal-workflows:code-review` for repository-specific rules and `$oh-my-codex:code-review` for general orchestration or an independent second opinion. Avoid duplicate planning, duplicate reviews, irrelevant specialist passes, and loading skills merely because they are available.

Repository-specific security requirements always override workflow convenience. Never weaken Supabase RLS, authorization, tenant isolation, permission checks, service-role credential handling, secret boundaries, or cross-company data protections to satisfy a test, workflow, agent, or completion condition.

Do not mark a task complete while blocking findings, change-caused verification failures, required migration or security checks, or unexplained unrelated diff remain. Final reports should state what changed, which workflows or reviews were used, which verification commands ran, remaining risks, and manual checks still required.

## Project Structure & Ownership

This repository is the private pnpm workspace `operations-portal`, with workspace packages declared as `apps/*` and `packages/*`. `apps/admin` is the Next.js web portal for owner, admin, manager, and personnel workflows. `apps/mobile` is the Expo / React Native app. Shared code lives in `packages/types`, `packages/validation`, `packages/shared`, and `packages/payments`; prefer these packages over duplicating business logic. Supabase configuration, migrations, fixtures, snippets, and database tests live in `supabase/`. Operational scripts live in `scripts/`, currently including `scripts/create-admin.ts`.

## Development Commands

Run commands from the repository root.

```bash
corepack enable
pnpm install
pnpm run dev:admin
pnpm run dev:mobile
pnpm run typecheck
pnpm run lint
pnpm run test
pnpm run build
pnpm run create-admin
```

`dev:admin` runs `next dev` for `@operations/admin`. `dev:mobile` runs Expo for `@operations/mobile`. `typecheck`, `lint`, and `test` run matching workspace scripts. `build` runs the admin production build and mobile typecheck. `create-admin` runs `tsx scripts/create-admin.ts`.

## Coding Style & Code Quality

Write TypeScript with 2-space indentation. Use PascalCase for React components, camelCase for functions and variables, and UPPER_SNAKE_CASE for environment variables. Keep validation in shared Zod/schema helpers when practical. Keep changes scoped, avoid unrelated refactors, and do not introduce dependencies without a clear reason. UI changes should preserve responsive behavior, immediate feedback, loading/disabled states, accessible labels, and mobile usability.

## Testing & Verification

Vitest tests currently exist as `*.test.ts` in `packages/validation/src`, `packages/shared/src`, and `packages/payments/src`. Add focused tests for changed validation, permissions, tenant isolation, rate limits, report numbering, subscription logic, payment helpers, exports, and deletion behavior. For app changes, run `pnpm run typecheck` plus relevant lint, test, or build commands. Manually verify affected login, report, assignment, PDF/export, and admin flows; check browser console and network errors for UI work.

## Security & Configuration

Never commit `.env`, `.env.local`, service-role keys, API tokens, or production secrets. `SUPABASE_SERVICE_ROLE_KEY` is server-only and must not be exposed to browser or mobile code. Client code may only use explicitly public-safe environment variables. Do not expose cross-company data through client queries, API responses, logs, exports, PDFs, or storage URLs. Enforce authorization server-side and/or through Supabase RLS, not only in the client.

## Database & Migration Safety

Schema, RLS, storage, and tenant-isolation changes must be implemented through new files in `supabase/migrations`. Do not modify already-applied production migrations. Do not delete or rewrite production data unless explicitly requested. For database access changes, verify RLS, tenant filtering, foreign-key behavior, deletion behavior, and compatibility with existing queries.

## Git & Change Safety

Commit history uses concise prefixes such as `feat:`, `fix:`, `style:`, `chore:`, and `refactor:`. Keep commits focused. Do not revert unrelated user changes. Do not use destructive Git commands, force push, or history rewrites unless explicitly requested. Before finishing substantial work, inspect the diff and ensure unrelated files were not changed.

## Pull Requests

Pull requests should include a short scope summary, important implementation notes, verification commands run, screenshots for visual UI changes, Supabase migration notes when applicable, environment variable changes when applicable, and known limitations or follow-up work when relevant.

## Agent Workflow

For non-trivial tasks, inspect the existing implementation before editing, identify affected callers and data paths, check nearby tests and conventions, make the smallest safe change, add or update tests when behavior changes, run relevant verification, review the final diff, and report changes plus remaining risks. Do not mark work complete while known typecheck, lint, test, or build failures caused by the change remain unresolved.
