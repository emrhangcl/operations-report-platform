# Database

## Supabase Structure

Supabase files are stored under `supabase/`:

- `config.toml`
- `migrations/`
- `fixtures/`
- `snippets/`
- `tests/`
- `.branches/`
- `.temp/`

Database schema, RLS, storage, triggers, helper functions, and tenant-isolation changes are represented by SQL migration files in `supabase/migrations`.

## Migrations

Migration names are timestamped, for example:

- `202608190001_initial_schema.sql`
- `20260829075914_add_saas_core_schema.sql`
- `20260902081154_enforce_tenant_isolation_on_core_tables.sql`

Do not modify already-applied production migrations. Create a new migration for schema, policy, storage, trigger, or function changes.

## Major Tables and Relationships

Verified created tables include:

- identity and tenant: `profiles`, `organizations`, `organization_members`
- customer operations: `companies`, `company_lines`, `vehicles`, `belts`, `equipment`
- reporting: `reports`, `report_personnel`, `report_process_types`, `report_process_actions`, `report_photos`, `report_number_counters`
- assignments: `installation_assignments`
- audit and platform: `audit_logs`, private `platform_admins`, private `platform_export_requests`
- billing: `plans`, `subscriptions`, `entitlements`, `invoices`, `payments`, `payment_events`

Verified relationships include `profiles.id` referencing `auth.users(id)`, reports referencing profiles, companies, and belts, report child tables referencing reports, company lines referencing companies, and installation assignments referencing profiles, reports, and companies.

## RLS Strategy

RLS is enabled on core public tables. Later migrations enforce organization filtering with `organization_id` and private helper functions. Admin policies allow broader organization access; personnel policies are narrower, such as access to owned reports or assigned installation work.

Exact final policy text for every table is Not yet documented here; inspect the latest relevant migration before changing access behavior.

## Tenant Ownership and Filtering

Organization ownership is the primary isolation boundary. Queries and mutations should filter by the authenticated user's organization context. Company, line, vehicle, belt, equipment, report, assignment, photo, export, billing, and logo operations must stay inside that organization.

## Deletion and Foreign Keys

Verified deletion behavior includes report child rows cascading from reports in the initial schema, later changes that preserve report history when personnel are deleted, and admin report deletion code that unlinks assignments and removes report photo records/storage paths. Exact final foreign-key behavior must be checked in migrations before destructive changes.

## Safe Migration Workflow

1. Inspect current migrations and affected API/client queries.
2. Add a new migration; do not rewrite old production migrations.
3. Include RLS and tenant filtering updates with schema changes.
4. Verify foreign keys, cascade/null behavior, and existing query compatibility.
5. Run available database tests when Supabase local tooling is available.
6. Document any required environment or deployment steps.
