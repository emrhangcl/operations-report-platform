# Database

The system uses a locally installed PostgreSQL 18 server. On Windows the binaries live in `%LOCALAPPDATA%\Programs\PostgreSQL\18` and the data directory in `%USERPROFILE%\OperationsPortal\postgres\data` (override with `PG_BIN_DIR` and `OPS_DATA_DIR`). The server listens on `127.0.0.1` only and requires `scram-sha-256` password authentication for every connection. `pnpm setup:local` creates the cluster, roles, and databases and applies the migrations.

Two databases exist:

- `operations_portal`: development data used by the running app.
- `operations_portal_test`: reset on every `pnpm db:test` run; never holds real data.

## Repository Layout

- `db/migrations`: ordered SQL migrations named `NNNN_description.sql`.
  - `0001_platform_foundation.sql`: `auth` schema (users, sessions, one-time tokens, security events, `auth.uid()`), `storage` schema (buckets, object metadata, `storage.foldername()`), and the `private` schema.
  - `0002_application_schema.sql`: the consolidated application schema (types, tables, functions, triggers, RLS policies, grants, storage policies, buckets). It is the exact final state of the 40 legacy migrations; a dump of both was compared line by line when it was created.
  - `0003_fix_trigger_record_field_access.sql`: fixes two multi-table trigger functions that referenced columns missing from some of their tables.
  - `0004_persistent_rate_limits.sql`: `private.rate_limit_buckets` and the `SECURITY DEFINER` functions `consume_rate_limit`, `peek_rate_limit`, and `reset_rate_limit` (executable by `service_role` only) that back the HTTP rate limits and the login IP block.
- `db/tests`: pgTAP security tests (see `docs/TESTING.md`).
- `scripts/local/postgres.mjs`: cluster lifecycle (`pnpm db:start`, `db:stop`, `db:restart`, `db:status`, `db:psql`) and role/database bootstrap.
- `scripts/db/migrate.ts`: migration runner (`pnpm db:migrate`, `pnpm db:reset --yes`, `--test` for the test database).

## Roles and Connections

| Role | Login | Purpose |
| --- | --- | --- |
| `postgres` | yes | Superuser for cluster bootstrap only. Its password is in `OPS_DATA_DIR/secrets`. The app never uses it. |
| `ops_owner` | yes | Owns the schemas and runs migrations (`DATABASE_MIGRATION_URL`). Not used by the running app. May `SET ROLE` to the request roles without inheriting their privileges, which the test runner needs. |
| `ops_app` | yes | Runtime connection (`DATABASE_URL`). `NOINHERIT`, connection limit 40, statement/lock/idle timeouts. It has no table privileges of its own. |
| `anon` | no | Unauthenticated requests (only public plan data). |
| `authenticated` | no | Signed-in user requests; subject to RLS. |
| `service_role` | no | `BYPASSRLS`; used only by server code after the route guard verified identity and organization. |

Every server transaction runs `SET LOCAL ROLE <role>` and `set_config('app.user_id', <uuid>, true)` (`apps/admin/lib/server/db.ts`). `auth.uid()` returns that value, so policies such as `id = auth.uid()` and helpers such as `private.current_organization_id()` work per request. Forgetting the role switch fails closed because `ops_app` cannot read any table.

## Migrations

- Migrations are append-only. `migrations.applied` stores each file's version, name, SHA-256 checksum, duration, and applying role. The runner refuses to continue if an applied file was edited.
- Add schema, policy, storage, trigger, function, or grant changes as a new file with the next number. Never edit `0001`–`0004` or any applied file.
- New tables get no default privileges: grant exactly what `authenticated`, `anon`, and `service_role` need, enable RLS, and add policies in the same migration.
- The runner takes an advisory lock, applies each pending file in its own transaction, and records it. Line endings are normalized before hashing, so CRLF checkouts do not change checksums.

```bash
pnpm db:migrate
pnpm db:migrate --test
pnpm db:reset --yes
```

`db:reset --yes` drops and recreates the managed schemas of the development database and deletes all its data.

## Major Tables and Relationships

- Identity: `auth.users`, `auth.sessions`, `auth.one_time_tokens`, `auth.security_events`.
- Tenant: `public.organizations`, `public.profiles` (one organization per user), `public.organization_members` (role `OWNER`, `ADMIN`, or `PERSONNEL`).
- Customer operations: `companies`, `company_lines`, `vehicles`, `belts`, `equipment`.
- Reporting: `reports`, `report_personnel`, `report_process_types`, `report_process_actions`, `report_photos`, `report_number_counters`.
- Assignments: `installation_assignments`.
- Audit and platform: `audit_logs`, `private.platform_admins`, `private.platform_export_requests`, `private.organization_deletion_jobs`.
- Billing: `plans`, `subscriptions`, `entitlements`, `invoices`, `payments`, `payment_events`.
- Files: `storage.buckets` (`report-photos` 5 MB, `organization-logos` 2 MB; JPEG, PNG, WebP; both private) and `storage.objects` (metadata; bytes live under `OPS_DATA_DIR/storage/<bucket>/<path>`).

`profiles.id` references `auth.users(id)`. Most tenant tables carry `organization_id`, filled by column defaults or triggers from the acting user's profile (`private.current_organization_id()`) or from the parent row (report children, company lines, report photos).

## RLS Strategy

RLS is enabled on all 22 `public` tables and on the `auth` and `storage` tables. `private` tables are not granted to `anon` or `authenticated` at all; only `service_role` and `SECURITY DEFINER` functions reach them. Policies combine:

- organization scoping through `private.current_organization_id()`, `private.is_organization_member(...)`, and `private.is_admin()`;
- role scoping: admins see their whole organization, personnel see their own reports and assigned work;
- restrictive `subscription_*_access` policies that block reads or writes when the subscription access mode is `blocked` or `read`;
- storage policies on `report-photos` that only allow object paths of the form `<organization_id>/<report_id>/<file>` for reports the user may access. `organization-logos` has no user policies; logo uploads and signed links go through server routes running as `service_role` with explicit organization checks.

`private.*` helper functions are `SECURITY DEFINER` with a fixed `search_path`. Client code must never bypass RLS; the only RLS-bypassing role is `service_role`, reachable only from server code.

## Deletion and Foreign Keys

- Report children (`report_personnel`, `report_photos`, `report_process_*`) cascade when a report is deleted.
- Deleting a profile sets report and assignment references to `NULL` (`created_by_user_id`, `updated_by_user_id`, `customer_signed_by`, `observer_personnel_id`, `report_personnel.profile_id`, `report_photos.created_by`), so signed report history survives. Name snapshots on the rows keep the display names.
- Deleting an `auth.users` row cascades to its profile, sessions, and one-time tokens.
- Most tenant tables reference `organizations` with `ON DELETE RESTRICT`. Organizations are removed only through the platform deletion RPCs, which purge tenant data first.
- Signed reports (`SUBMITTED` with a customer signature) and their child rows cannot be changed or deleted by users; only cascades from deleting the parent report or the FK nulling above are allowed.

## Backups

Backups cover the database and the file store together, because a restore needs both. They are encrypted with `BACKUP_ENCRYPTION_KEY`; details of the format are in `docs/SECURITY.md`.

```bash
pnpm backup                    # create an encrypted set in BACKUP_DIR (default OPS_DATA_DIR/backups)
pnpm backup:list               # list sets with size, report count, and file count
pnpm backup:verify             # restore drill for the newest set into the test database
pnpm backup:verify <set-name>  # restore drill for a specific set
pnpm backup:schedule           # daily Windows scheduled task (BACKUP_TIME, default 02:00)
pnpm backup:unschedule
```

Each set is a folder named after its UTC timestamp, holding `database.dump.enc`, `storage.tar.enc`, and `manifest.json`. The newest `BACKUP_RETENTION` sets (default 14) are kept, and `BACKUP_COPY_DIR` can receive a second copy, for example on an external disk.

`backup:verify` only restores into `operations_portal_test`. To restore into the development database after data loss:

1. Stop the app and run `pnpm backup:verify <set-name>` to confirm the set is intact.
2. Decrypt the dump and storage archive with the helpers in `scripts/backup/crypto.ts` (`createDecryptStream`) and restore with `pg_restore --clean --if-exists --no-owner --dbname "<DATABASE_MIGRATION_URL>"`; extract the storage archive into `OPS_DATA_DIR`.
3. Start the app and run `pnpm test:e2e`.

There is no one-command restore into the development database on purpose, so a mistyped command cannot overwrite live data.

## Safe Migration Workflow

1. Inspect the current schema (`pnpm db:psql`) and the affected API routes and client queries.
2. Add a new numbered migration; do not rewrite applied migrations.
3. Include grants, RLS policies, and tenant filtering with every schema change.
4. Verify foreign keys, cascade/null behavior, and compatibility with existing queries.
5. Run `pnpm db:test` and extend `db/tests` for new security-relevant behavior.
6. Apply with `pnpm db:migrate` and run `pnpm test:e2e` against the running app.
7. Document new environment variables or operational steps.
