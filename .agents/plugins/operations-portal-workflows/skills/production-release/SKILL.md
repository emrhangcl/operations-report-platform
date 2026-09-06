---
name: production-release
description: Use for preparing or checking a production release without deploying unless deployment is explicitly requested.
---

# Production Release

Use this workflow for release readiness, pre-deploy checks, or production handoff.

## Project References

Read:

- `AGENTS.md`
- `docs/DEPLOYMENT.md`
- `docs/SECURITY.md`
- `docs/DATABASE.md`
- `docs/TESTING.md`
- `docs/ARCHITECTURE.md` when release scope touches flows or services

## Workflow

1. Treat release as a verification gate, not a deployment command.
2. Inspect git status, commits, and diff to identify changed files, migrations, environment requirements, dependency changes, and release scope.
3. Verify no secrets, `.env` files, service-role keys, API tokens, or local-only artifacts are being committed.
4. Review database migrations for RLS, tenant filtering, indexes, foreign keys, backward compatibility, deployment ordering, and production data risk.
5. Check deployment-related configuration, required environment variables, and known Not yet documented areas from `docs/DEPLOYMENT.md`.
6. Run or request appropriate verification: typecheck, lint, tests, production build, migration checks, and targeted smoke checks for affected flows.
7. Identify rollback concerns, mitigation options, manual migration steps, and operational unknowns.
8. Review the final git diff and summarize release risk.
9. Report exact commands run and results. If a command was skipped or failed, state that plainly.

Never claim the release is safe solely because the build passed; call out unresolved security, migration, environment, and operational risks.

Never deploy automatically unless the user explicitly requests deployment.
