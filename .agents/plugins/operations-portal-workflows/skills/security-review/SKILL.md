---
name: security-review
description: Use for reviewing this repository for authentication, authorization, tenant isolation, RLS, secrets, storage, API, validation, and data exposure risks.
---

# Security Review

Use this workflow for security audits, hardening reviews, or risk-focused inspection. Do not make unrelated feature changes.

## Project References

Read:

- `AGENTS.md`
- `docs/SECURITY.md`
- `docs/DATABASE.md`
- `docs/ARCHITECTURE.md`
- `docs/TESTING.md` for available verification

## Review Focus

Inspect authentication, authorization, organization/company isolation, Supabase RLS, storage and signed URLs, server-only secrets, request validation, sensitive output, logging, exports, PDFs, privilege boundaries, and cross-tenant data exposure.

## Workflow

1. Identify the review scope and map target flows, actors, trust boundaries, and protected data before making judgments.
2. Inspect server routes, Supabase helpers, migrations, RLS policies, client queries, storage paths, shared permission logic, exports, PDFs, and logs.
3. Trace untrusted inputs and privileged data paths through authn, authz, organization filtering, company filtering, storage access, validation, and output generation.
4. Report findings first, ordered by severity. Include severity, affected file/location, evidence, concrete attack or data path, impact, and a practical remediation.
5. Do not report theoretical issues unless there is an actual path to unauthorized access, tenant leakage, secret exposure, unsafe mutation, sensitive output, or privilege escalation.
6. Separate confirmed findings from assumptions or follow-up questions. State when no significant security finding exists.
7. If asked to fix issues, keep fixes scoped and preserve current product behavior.
8. Run relevant tests or explain clearly when checks were not run.
9. Review final diff if any file was changed.

Never run destructive database or git operations without explicit approval.
