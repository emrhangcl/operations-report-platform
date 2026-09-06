---
name: code-review
description: Use for reviewing repository changes for correctness, regressions, security, tenant isolation, performance, maintainability, and tests.
---

# Code Review

Use this workflow when the user asks for a review, PR review, diff review, or risk assessment.

## Project References

Read relevant sections from:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/SECURITY.md`
- `docs/DATABASE.md` for schema/RLS/storage changes
- `docs/TESTING.md`
- `docs/DEPLOYMENT.md` for release-sensitive changes

## Workflow

1. Identify the reviewed range or files. Use git status, git diff, merge-base, or the provided PR context when available.
2. Inspect changed code plus nearby unchanged code needed to understand behavior, callers, deleted guards, shared helpers, and tests.
3. Prioritize correctness bugs, regressions, security issues, tenant isolation gaps, RLS mistakes, data loss, performance risks, and missing tests over style.
4. Verify each candidate issue against the code before reporting it. Do not report vague concerns without a concrete failure scenario.
5. Provide findings first, ordered by severity, with concrete file/line references when possible.
6. Separate blocking issues from non-blocking suggestions and open questions.
7. Avoid stylistic comments unless they hide a concrete maintainability or correctness risk.
8. Note skipped checks and residual risks.
9. If no significant issues are found, say so directly and mention remaining test gaps.

Do not make code changes during review unless the user explicitly asks for fixes.
