---
name: bug-fix
description: Use for fixing a reported bug with root-cause analysis, minimal changes, regression coverage, and verification.
---

# Bug Fix

Use this workflow for defects, runtime errors, broken UI flows, failed API calls, or incorrect data behavior.

## Project References

Start with `AGENTS.md`, then consult:

- `docs/ARCHITECTURE.md` for affected flow ownership
- `docs/SECURITY.md` for auth, isolation, API, and storage boundaries
- `docs/DATABASE.md` for schema, RLS, and deletion behavior
- `docs/TESTING.md` for verification order and test locations

## Workflow

1. Separate the reported symptom from the suspected root cause. Record what is observed, what is inferred, and what remains unknown.
2. Reproduce the failure or establish evidence before changing code when practical, using logs, screenshots, requests, tests, database state, or code-path tracing.
3. Locate the responsible module and root cause. Avoid speculative fixes, cosmetic rewrites, or changes that only mask the symptom.
4. Check whether the same root cause appears in sibling UI/API/shared/database paths.
5. Apply the smallest safe fix in the responsible module, preserving existing behavior outside the bug.
6. Add or update regression coverage when the current test structure supports it; otherwise document the manual regression check.
7. Verify with the narrowest useful command first, then broader typecheck, lint, test, or build as risk requires.
8. Check tenant isolation, PostgreSQL RLS, auth boundaries, and server-only secret handling if the fix touches data access.
9. Review the final git diff for unrelated edits and for code that contradicts the identified root cause.
10. Report symptom, evidence, root cause, fix, regression coverage, verification actually run, and remaining risk.

Do not hide unresolved failures or present unrun checks as passing.
