---
name: performance-review
description: Use for finding concrete performance risks in this repository without premature optimization or automatic code changes.
---

# Performance Review

Use this workflow for performance reviews of `operations-portal` code, queries, routes, exports, PDFs, or dependency changes. Do not modify code unless the user explicitly asks for fixes.

## Project References

Read relevant sections from:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md` when Supabase queries, indexes, RLS, migrations, or data volume are involved
- `docs/TESTING.md` for verification context
- `docs/DEPLOYMENT.md` when build, bundle, runtime, or release behavior may be affected

## Review Focus

Inspect React rendering, Next.js routes, API handlers, Supabase queries, database access, exports, PDF generation, shared packages, large loops, repeated network calls, repeated queries, N+1 patterns, large payloads, blocking operations, unnecessary client-side work, caching opportunities, and bundle or dependency impact.

## Workflow

1. Identify the reviewed scope, user-visible operation, expected data size, and runtime surface.
2. Inspect relevant client, server, database, network, external service, export, PDF, and shared-package paths before reporting.
3. Look for N+1 access, repeated queries, oversized payloads, blocking work, hot render loops, unnecessary client-side processing, and avoidable dependency or bundle growth.
4. Require evidence before reporting a performance issue. Evidence can be a measured result, query shape, loop cardinality, repeated network path, bundle impact, or code path tied to realistic data volume.
5. Do not report theoretical micro-optimizations or style-only efficiency preferences as findings.
6. Prioritize user-visible latency, resource cost, production scalability, and paths that grow with tenants, companies, reports, assignments, exports, or PDFs.
7. Identify the likely bottleneck as client, server, database, network, or external service.
8. For each significant finding, report severity, location, evidence, impact, likely cause, recommended improvement, and measurement or verification method.
9. Separate confirmed findings from assumptions, skipped checks, and residual risks.
