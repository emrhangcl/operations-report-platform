# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Organization owners, admins, and managers use the web portal to coordinate operational records, access, billing, and reporting within their organization.
- Personnel use role-appropriate web workflows to receive assignments, record field work, and complete reports.
- Platform administrators use protected owner routes to manage organizations, plans, payments, and platform logs.

## Product Purpose

Operasyon Portalı coordinates field installation work from assignment through operational reporting. It gives authorized users one organization-scoped web workspace for maintaining operational entities, completing work, reviewing reports, and producing PDF or Excel documents.

## Positioning

The implemented product centers the assignment-to-report workflow in the same tenant-isolated system as personnel, company, line, vehicle, belt, equipment, subscription, and organization administration. Broader market positioning is not documented in the repository and must not be invented.

## Operating Context

- The primary production surface is the Next.js App Router application in `apps/admin`.
- Work is organization-scoped and role-sensitive. Admin, personnel, and platform-owner routes expose different controls and data.
- Field and office workflows cover assignments, report creation and submission, signed delivery approval, restricted return closeout, report detail, PDF generation, and Excel export.
- The interface and product copy are primarily Turkish and are used in the Europe/Istanbul operating context.
- Supabase provides authentication, Postgres data, row-level security, and private storage; Vercel hosts the web application and optional analytics.

## Capabilities and Constraints

- Manage organizations, users, companies, lines, vehicles, belts, equipment, assignments, reports, branding, subscriptions, plans, and payment records through authorized surfaces.
- Generate organization-aware report PDFs and Excel exports from real stored data.
- Preserve authentication, server-side authorization, organization isolation, Supabase RLS, permission checks, subscription access modes, validation, API contracts, auditability, and private-file boundaries.
- Keep service-role credentials server-only and never expose cross-organization data through pages, APIs, exports, PDFs, logs, or storage URLs.
- `apps/mobile` is a separate Expo application and does not define the visual platform or design context for this web product.
- Do not fabricate customers, testimonials, metrics, logos, activity, records, product claims, or capabilities.

## Brand Commitments

- Product name: Operasyon Portalı.
- Voice: direct, operational, concise, and action-oriented Turkish. Labels describe real work rather than promotional abstractions.
- Organization branding may supply a real tenant logo; the product must retain a safe default identity when no organization logo exists.

## Evidence on Hand

- Product boundaries and data flows: `docs/ARCHITECTURE.md`.
- Authentication, authorization, tenant isolation, RLS, API, storage, and secret constraints: `docs/SECURITY.md`.
- Verification expectations: `docs/TESTING.md`.
- Current routes and product copy: `apps/admin/app` and `apps/admin/components`.
- Existing visual tokens and responsive rules: `apps/admin/app/enterprise-system.css` and `apps/admin/app/globals.css`.
- No verified customer names, testimonials, outcome metrics, market-share claims, or public case studies are present; future design work must not invent them.

## Product Principles

- Make current operational state and the next authorized action easy to scan.
- Keep role and organization context visible wherever it affects meaning or permissions.
- Prefer truthful system data and explicit empty, loading, error, disabled, and read-only states.
- Preserve document accuracy and workflow integrity from data entry through PDF and Excel output.
- Support field and office use with responsive layouts, keyboard access, legible controls, and reduced-motion behavior.

## Accessibility & Inclusion

The existing web application includes visible focus treatment, skip links, semantic controls, ARIA labels, responsive navigation, touch-friendly actions, and reduced-motion rules. Future UI work must preserve these behaviors and should verify keyboard operation, focus management, contrast, responsive reflow, loading/error announcements, and Turkish copy clarity.
