---
name: full-bug-fix
description: Use for investigating and fixing a non-trivial bug with evidence, root-cause analysis, specialist checks, regression coverage, and verification.
---

# Full Bug Fix

Use this workflow for non-trivial bugs that need disciplined investigation, a scoped root-cause fix, and regression verification. Do not use unsupported nested-skill syntax; read relevant sibling `SKILL.md` files as procedural sources and apply their phases.

## Workflow Sources

Always read:

- `AGENTS.md`
- relevant `docs/*`
- `../bug-fix/SKILL.md`
- `../code-review/SKILL.md`

Read specialist sources only when relevant:

- `../security-review/SKILL.md` for security or data-boundary bugs
- `../database-migration/SKILL.md` when a database change is actually necessary
- `../ui-review/SKILL.md` when user-facing behavior changes
- `../performance-review/SKILL.md` when performance is part of the symptom or root cause

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

1. Evidence: state the observed symptom, gather evidence, reproduce when practical, trace callers and data paths, separate symptom from root cause, and avoid speculative edits.
2. Impact: determine whether the root cause affects other routes, components, shared packages, tenants, APIs, database queries, storage, permissions, or external integrations.
3. Fix: apply the smallest safe root-cause fix, avoid symptom masking, avoid unrelated cleanup, and add regression coverage when practical.
4. Specialist checks: apply only relevant security, database, UI, or performance phases based on the touched surfaces and root cause.
5. Code review: inspect the final diff and sibling paths, explicitly checking whether the same root cause exists elsewhere.
6. Verification: run relevant typecheck, lint, tests, and build according to risk and `docs/TESTING.md`; confirm the original failure path is fixed when practical.
7. Final report: summarize symptom, root cause, fix, regression coverage, similar paths checked, verification executed, files changed, and remaining risks.

Do not hide unresolved failures or present unrun checks as passing.
