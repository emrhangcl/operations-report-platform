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

`AGENTS.md` and `docs/*` remain the authoritative source of truth for this repository. Repository-specific architecture, security, database, testing, deployment, tenant-isolation, PostgreSQL RLS, permissions, and business rules take precedence over generic workflow guidance.

oh-my-codex is the general orchestration layer. Use available OMX workflows when requirements clarification, deep analysis, research, planning, architecture discussion, durable checkpoints, complex multi-stage work, specialist coordination, long-running execution, verification, or QA materially improve the result. Relevant detected OMX invocations include `$oh-my-codex:deep-interview`, `$oh-my-codex:plan`, `$oh-my-codex:ralplan`, `$oh-my-codex:analyze`, `$oh-my-codex:ultragoal`, `$oh-my-codex:ultraqa`, `$oh-my-codex:autopilot`, and `$oh-my-codex:code-review`.

operations-portal-workflows provides repository-specific engineering procedures. Detected specialist invocations are `$operations-portal-workflows:architecture-review`, `$operations-portal-workflows:bug-fix`, `$operations-portal-workflows:code-review`, `$operations-portal-workflows:database-migration`, `$operations-portal-workflows:feature-development`, `$operations-portal-workflows:performance-review`, `$operations-portal-workflows:production-release`, `$operations-portal-workflows:security-review`, and `$operations-portal-workflows:ui-review`. Detected master workflow invocations are `$operations-portal-workflows:full-feature`, `$operations-portal-workflows:full-bug-fix`, and `$operations-portal-workflows:release-candidate`.

Choose one primary orchestration path for a task. For ordinary repository-specific feature work, prefer `$operations-portal-workflows:full-feature` when the task is clear and mainly implementation-focused; use OMX as primary when the task needs substantial clarification, research, architecture comparison, durable checkpoints, broad impact analysis, or complex coordination. For ordinary repository-specific bugs, prefer `$operations-portal-workflows:full-bug-fix` when the problem is scoped; use OMX analysis or planning when the bug is ambiguous, cross-cutting, difficult to reproduce, or needs deeper investigation. For release readiness, prefer `$operations-portal-workflows:release-candidate`; OMX QA or review may supplement it. Never deploy without explicit user instruction.

Select only workflows relevant to the actual change. Feature work may use `$operations-portal-workflows:feature-development`, plus architecture, security, database, UI, performance, and repository code review only when those concerns are touched. Bug work should establish evidence and root cause before edits, then add security, database, UI, performance, or architecture review only when the root cause or fix requires it. Release work should inspect git status and diff, migration and environment changes, and relevant tests, typecheck, lint, or build output; distinguish pre-existing failures from failures caused by the change.

When both plugins expose the same skill name, use the exact namespaced invocation. The detected collision is `code-review`: use `$operations-portal-workflows:code-review` for repository-specific rules and `$oh-my-codex:code-review` for general orchestration or an independent second opinion. Avoid duplicate planning, duplicate reviews, irrelevant specialist passes, and loading skills merely because they are available.

Repository-specific security requirements always override workflow convenience. Never weaken PostgreSQL RLS, authorization, tenant isolation, permission checks, service-role credential handling, secret boundaries, or cross-company data protections to satisfy a test, workflow, agent, or completion condition.

Do not mark a task complete while blocking findings, change-caused verification failures, required migration or security checks, or unexplained unrelated diff remain. Final reports should state what changed, which workflows or reviews were used, which verification commands ran, remaining risks, and manual checks still required.

### Autonomous Workflow & Compute Selection

- **Select automatically.** For every task, assess scope, complexity, ambiguity, risk, affected application surfaces, security, database, architecture and UI impact, and expected duration. Select the smallest appropriate workflow set from natural-language requests; ordinary work requires no manual `$skill` invocation or agent selection. Explicit user `$skill` invocations take precedence within the repository's safety rules. Ask for clarification only when genuine ambiguity affects the outcome.
- **Keep skills relevant.** Apply the `operations-portal-workflows` specialists listed above only when their domain is affected: `feature-development` for feature implementation when useful; `bug-fix` for bugs; `ui-review` for user-facing UI; `database-migration` for schema/RLS changes; `security-review` for authentication, authorization, tenant isolation or security; `architecture-review` for architectural boundaries; `performance-review` for credible performance concerns; and `code-review` for final repository review when warranted. Use `release-candidate` or `production-release` for release preparation as appropriate. Do not invoke every skill by default.
- **Choose one primary orchestrator.** Start simple, well-scoped work with direct execution and only the relevant specialists. The master-workflow preferences above apply when the task warrants a master workflow. Select OMX automatically when deeper planning or coordination meaningfully helps ambiguous, cross-cutting, architectural, research-heavy, risky, long-running, multi-stage or difficult debugging work, using workflows supported by the current runtime. Never automatically combine a repository master workflow with a complete OMX orchestration chain for the same task. Under OMX, use repository specialists only when they add operations-portal-specific knowledge.
- **Match compute to the task.** Prefer the lowest compute and reasoning effort that can safely complete the work. These are conceptual effort tiers; use supported controls where available rather than claiming an unavailable model or effort switch:

  | Effort | Typical work |
  | --- | --- |
  | LOW | Repository search, simple inspection, formatting, naming, small copy changes, trivial UI adjustments, straightforward documentation and status checks. |
  | MEDIUM | Normal features, ordinary planning, component refactoring, standard API changes, ordinary database work, normal security checks and common bug fixes. |
  | HIGH | Difficult debugging, cross-cutting changes, important final verification, complex code review, risky refactors and subtle permission or data-flow problems. |
  | XHIGH | Major architecture decisions, extremely ambiguous problems, large system redesigns, difficult multi-system tradeoffs and high-risk reasoning where lower effort is insufficient. |

- **Conserve tokens and context.** Prefer targeted inspection of relevant files, targeted tests first, incremental verification, reuse of gathered evidence and concise agent handoffs. Avoid rereading unchanged large files, unrelated skills, duplicate research/plans/reviews, full-repository tests for tiny isolated changes when targeted checks suffice, multiple agents for work one agent can safely finish, and exploration after sufficient evidence exists. Never trade correctness, security, tenant isolation or necessary verification for token savings.
- **Escalate on evidence.** Start with the least expensive reasonable approach. Add skills, specialist agents, deeper planning or higher reasoning only when inspection reveals complexity, evidence is insufficient, verification fails, architecture/security implications emerge or scope expands. HIGH and XHIGH are not defaults merely because they are available.
- **Keep the experience simple.** Requests such as "Redesign the owner dashboard", "Fix the report export bug", "Add company license expiration" or "Make this table easier to use" should be sufficient to determine OMX involvement, relevant repository skills, any necessary specialist agents and proportional verification. At completion, briefly name the primary workflow (or direct execution), specialists/agents actually used and verification performed, alongside the existing reporting requirements; omit unnecessary internal orchestration detail.

## Impeccable Design Routing

Impeccable is the repository's primary visual-design and frontend-UX system for `apps/admin`. Automatically load the project-local `impeccable` skill when work materially involves a new or redesigned user-facing web surface, dashboards, landing or marketing pages, navigation, application shells, tables, forms, modals, settings, onboarding, empty states, responsive UI, spacing and layout, typography, color, visual hierarchy, UI accessibility, interaction states, motion, frontend UX copy, visual consistency, design-system extraction, frontend polish, design critique, or visual implementation audits. Natural-language requests are sufficient; users do not need to invoke `$impeccable` manually.

Impeccable owns visual-design guidance. `$operations-portal-workflows:ui-review` remains responsible for repository-specific UI validation, workflow correctness, and project conventions. OMX remains the orchestration layer for large or cross-cutting work. Do not run competing generic frontend-design skills alongside Impeccable or introduce conflicting design vocabularies.

Repository architecture, security, product truth, and business rules always take priority over aesthetic changes. No visual work may weaken authentication, authorization, tenant isolation, PostgreSQL RLS, permission handling, form validation, data integrity, API contracts, report or export workflows, or role-specific behavior.

Use a proportional Impeccable flow. For an existing page, critique or audit only when needed, then make a targeted refinement, polish, and run detector verification. For a new or substantially redesigned surface, shape the work, implement it, critique or audit it, polish it, and run detector verification. Use focused commands such as `layout`, `typeset`, `colorize`, `distill`, `bolder`, `quieter`, `harden`, `adapt`, `clarify`, `animate`, or `delight` only when materially relevant; do not run every design command automatically.

## Project Structure & Ownership

This repository is the private pnpm workspace `operations-portal`, with workspace packages declared as `apps/*` and `packages/*`. `apps/admin` is the Next.js web portal for owner, admin, manager, and personnel workflows. `apps/mobile` is the Expo / React Native app. Shared code lives in `packages/types`, `packages/validation`, `packages/shared`, and `packages/payments`; prefer these packages over duplicating business logic. Database migrations live in `db/migrations` and pgTAP database tests in `db/tests`; local PostgreSQL tooling lives in `scripts/local` and `scripts/db`. Operational scripts live in `scripts/`, currently including `scripts/create-admin.ts`.

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

Never commit `.env`, `.env.local`, service-role keys, API tokens, or production secrets. `DATABASE_URL`, `DATABASE_MIGRATION_URL` and `AUTH_SECRET` are server-only and must never be exposed to browser or mobile code; the `service_role` database role is used only by verified server code. Client code may only use explicitly public-safe environment variables. Do not expose cross-company data through client queries, API responses, logs, exports, PDFs, or storage URLs. Enforce authorization server-side and/or through PostgreSQL RLS, not only in the client.

## Database & Migration Safety

Schema, RLS, storage, and tenant-isolation changes must be implemented through new files in `db/migrations`. Do not modify already-applied production migrations. Do not delete or rewrite production data unless explicitly requested. For database access changes, verify RLS, tenant filtering, foreign-key behavior, deletion behavior, and compatibility with existing queries.

## Git & Change Safety

Commit history uses concise prefixes such as `feat:`, `fix:`, `style:`, `chore:`, and `refactor:`. Keep commits focused. Do not revert unrelated user changes. Do not use destructive Git commands, force push, or history rewrites unless explicitly requested. Before finishing substantial work, inspect the diff and ensure unrelated files were not changed.

## Pull Requests

Pull requests should include a short scope summary, important implementation notes, verification commands run, screenshots for visual UI changes, database migration notes when applicable, environment variable changes when applicable, and known limitations or follow-up work when relevant.

## Agent Workflow

For non-trivial tasks, inspect the existing implementation before editing, identify affected callers and data paths, check nearby tests and conventions, make the smallest safe change, add or update tests when behavior changes, run relevant verification, review the final diff, and report changes plus remaining risks. Do not mark work complete while known typecheck, lint, test, or build failures caused by the change remain unresolved.
