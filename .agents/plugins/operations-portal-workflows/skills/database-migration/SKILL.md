---
name: database-migration
description: Use for PostgreSQL schema, RLS, storage policy, trigger, function, foreign-key, or tenant-isolation changes in this repository.
---

# Database Migration

Use this workflow for changes under `db/migrations` or application changes that require database updates.

## Project References

Read:

- `AGENTS.md`
- `docs/DATABASE.md`
- `docs/SECURITY.md`
- `docs/ARCHITECTURE.md` for affected data flows
- `docs/TESTING.md`
- `docs/DEPLOYMENT.md` for release expectations

## Workflow

1. Inspect the current schema before designing the change: latest migrations, affected tables, RLS policies, indexes, foreign keys, triggers, RPC functions, storage policies, and existing app queries.
2. Determine the forward migration and the rollback or mitigation strategy. Call out any data rewrite, lock, downtime, or manual recovery concern.
3. Create a new migration. Never edit shipped or already-applied production migrations.
4. Preserve organization-level tenant boundaries and company-level filtering where applicable.
5. Check RLS for every new or changed table, policy, storage path, function, and write path.
6. Check indexes, foreign-key behavior, deletion behavior, null/cascade semantics, and compatibility with existing API/client queries.
7. Consider deployment ordering and backward compatibility between old application code, new application code, and the migrated schema.
8. Update shared types or validation only if the schema change requires it.
9. Run relevant TypeScript checks, package tests, and the pgTAP database tests (`pnpm db:test`).
10. Review the final diff and report migration impact, rollback/mitigation path, deployment ordering, skipped checks, and unknown risks.

Do not delete or rewrite production data unless the user explicitly approves that exact operation.
