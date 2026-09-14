---
name: Operasyon Portalı Admin
description: Dark Frosted Technical control surface for tenant-scoped field and office work.
colors:
  graphite: "oklch(0.196 0.014 259)"
  graphite-subtle: "oklch(0.218 0.016 259)"
  panel: "oklch(0.246 0.018 259)"
  panel-raised: "oklch(0.272 0.02 259)"
  panel-subtle: "oklch(0.226 0.017 259)"
  panel-muted: "oklch(0.286 0.019 259)"
  line: "oklch(0.332 0.021 258)"
  line-strong: "oklch(0.405 0.024 258)"
  mist: "oklch(0.671 0.023 250)"
  ice: "oklch(0.955 0.006 250)"
  text-soft: "oklch(0.86 0.012 250)"
  text-subtle: "oklch(0.57 0.025 250)"
  signal: "oklch(0.775 0.152 71)"
  signal-hover: "oklch(0.83 0.145 76)"
  signal-soft: "oklch(0.775 0.152 71 / 0.13)"
  success: "oklch(0.79 0.12 160)"
  success-soft: "oklch(0.58 0.1 160 / 0.16)"
  warning: "oklch(0.82 0.14 76)"
  warning-soft: "oklch(0.68 0.14 76 / 0.16)"
  danger: "oklch(0.72 0.16 25)"
  danger-hover: "oklch(0.78 0.16 25)"
  danger-soft: "oklch(0.58 0.15 25 / 0.16)"
  info: "oklch(0.78 0.1 225)"
  info-soft: "oklch(0.58 0.1 225 / 0.16)"
typography:
  display:
    fontFamily: "var(--source-font-display), ui-sans-serif, sans-serif"
    fontSize: "clamp(2.2rem, 6vw, 3.75rem)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "normal"
  headline:
    fontFamily: "var(--source-font-display), ui-sans-serif, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 2.5rem)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: "var(--source-font-body), ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "var(--source-font-body), ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "var(--source-font-body), ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.25
    letterSpacing: "normal"
  technical:
    fontFamily: "var(--source-font-display), ui-sans-serif, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.14em"
rounded:
  sm: "0.5rem"
  md: "0.75rem"
  panel: "1rem"
  hero: "1.5rem"
  full: "999px"
spacing:
  xs: "0.375rem"
  sm: "0.5rem"
  md: "0.75rem"
  base: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  section: "5rem"
  shell: "4rem"
components:
  button-signal:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.md}"
    padding: "0.625rem 1.25rem"
    height: "2.625rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ice}"
    rounded: "{rounded.md}"
    padding: "0.625rem 1.25rem"
    height: "2.625rem"
  input:
    backgroundColor: "{colors.panel-subtle}"
    textColor: "{colors.ice}"
    rounded: "{rounded.sm}"
    padding: "0.625rem 0.75rem"
    height: "2.5rem"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ice}"
    rounded: "{rounded.md}"
    padding: "1rem"
  nav-active:
    backgroundColor: "{colors.signal-soft}"
    textColor: "{colors.signal}"
    rounded: "{rounded.sm}"
    height: "2.5rem"
---

# Design System: Operasyon Portalı Admin

## Overview

**Creative North Star: "Frosted Technical Operations"**

Operasyon Portalı Admin now belongs to the first-open landing screen's dark technical world. The system is graphite first: a low-glare operational canvas, translucent dark panels, fine steel borders, ice text, mist support copy, and amber signal for action, focus, route state, and proof. Every public, authentication, admin, owner, and personnel web surface should feel like one continuous operating environment rather than a jump between marketing and product skins.

The design should stay technical, compact, and calm. Frost is a material layer for sticky headers, authentication panels, drawers, dialogs, and the public product shell; it is not decorative glass. Product truth, role context, organization boundaries, report integrity, and permission state remain more important than atmosphere.

**Key Characteristics:**

- Graphite canvas with dark panel layering across public and authenticated routes.
- Amber signal reserved for primary action, focus, route state, counters, proof markers, and active progress.
- Ice text and mist support copy create hierarchy without returning to a light enterprise surface.
- Space Grotesk is public/display voice; IBM Plex Sans is the operational UI and body voice.
- Borders, translucent panels, blur, and restrained shadow build depth without decorative dashboard novelty.
- Turkish operational copy stays direct, role-safe, tenant-aware, and grounded in real workflows.

## Colors

The palette is a dark Frosted Technical system extracted from `frosted-system.css` and the first-open landing screen. The frontmatter is normative.

### Primary

- **Graphite:** The full-page canvas and continuity layer for public, authentication, admin, owner, and personnel routes.
- **Panel:** The standard working surface for cards, tables, form panels, public boards, and workspace modules.
- **Line:** The default structural border for panels, controls, navigation rows, tables, headers, and ledgers.
- **Mist:** Supporting text, secondary navigation, subdued metadata, captions, and explanatory copy.
- **Signal:** The amber action and focus color for primary buttons, active routes, focus rings, proof markers, progress, and selected states.
- **Ice:** Primary text, headings, lockups, and high-confidence operational values.

### Secondary

- **Panel Raised:** Dialogs, lightboxes, and raised work surfaces that sit above the standard panel layer.
- **Panel Subtle:** Field backgrounds, workspace cards, quiet bands, segmented controls, and nested operational containers.
- **Signal Soft:** Low-emphasis selected backgrounds and amber icon wells.

### Tertiary

- **Success:** Completed, approved, constructive, and valid workflow states.
- **Warning:** Subscription, draft, pending, grace, and caution states.
- **Danger:** Destructive, failed, invalid, irreversible, or blocked states.
- **Info:** Informational system messages only.

### Neutral

- **Graphite Subtle:** Sticky bars, public bands, and secondary shell backgrounds.
- **Panel Muted:** Hover rows, disabled tracks, and muted state surfaces.
- **Line Strong:** Scrollbar thumbs, stronger dividers, and borders that must survive dark-panel compression.
- **Text Soft / Text Subtle:** Intermediate and faint copy levels when mist is either too quiet or too prominent.

### Named Rules

**The First-Viewport Authority Rule.** New web surfaces inherit the landing page's graphite, panel, line, mist, signal, and ice world before local styling decisions.

**The Amber Signal Rule.** Signal is operational amber, not generic brand color; use it for state, action, focus, progress, and proof.

**The Semantic Reserve Rule.** Success, warning, danger, and info colors keep their workflow meaning and must not become decorative accents.

## Typography

**Display Font:** Space Grotesk through `--source-font-display`

**Body Font:** IBM Plex Sans through `--source-font-body`

**Label/Technical Font:** IBM Plex Sans for product labels; Space Grotesk only for public codes, counters, and compact technical marks

**Character:** Space Grotesk gives the public and high-level surfaces their technical stance. IBM Plex Sans keeps dense operational UI readable in forms, tables, reports, menus, and role-sensitive workflows.

### Hierarchy

- **Display** (600, responsive display scale, 1): Public hero and authentication context headlines.
- **Headline** (600, responsive section scale, 1.25): Public sections and major app screen headings where the surface can breathe.
- **Title** (600, 1.125rem, 1.25): Panels, tables, cards, forms, dialogs, shell headers, and compact product sections.
- **Body** (400, 0.875rem, 1.5): Dense task content, table cells, helper copy, report context, and normal UI text.
- **Label** (500, 0.8125rem, 1.25): Navigation, field labels, button labels, account context, and operational metadata.
- **Technical** (600, 0.6875rem, uppercase spacing): Status headers, plan codes, proof labels, and small public system marks.

### Named Rules

**The Split Font Rule.** Space Grotesk may lead public/display moments; IBM Plex Sans owns product UI and body text.

**The No Light Reset Rule.** Typography changes must not be used to make authenticated workflows feel like a separate light enterprise product.

## Layout

The public landing screen is the visual authority: a sticky 4rem frosted header, an 80rem centered container, a one-column mobile-first hero, a 12-column desktop hero at 64rem, and section rhythm around 5rem to 7rem. Public content uses bordered workflow grids, feature ledgers, pricing panels, and a frosted product shell to show real operational capability without fabricated metrics.

Authenticated surfaces continue the same world with a dark fixed rail, compact top bar, bordered work panels, and immediate primary actions. The existing 17rem sidebar, 4rem top bar, 92rem page max, and responsive off-canvas drawer remain valid product structure, but their surface language is graphite and amber. Dense tables keep horizontal scroll when operational data needs width.

Authentication uses a dark split workspace: context on one side, form panel as the primary working surface, no visual reset between landing and login/register. At 900px, sidebars become drawers. At 620px, authentication compresses into a single working column with the contextual copy hidden and the form panel taking the full viewport work area. At 560px and below, app content gutters tighten while panels keep usable touch targets.

## Elevation & Depth

The system is dark and layered, not shadow-heavy. Depth comes from graphite canvas, panel tones, translucent frost, fine borders, blur, and only then shadow. Ordinary cards, table panels, and form panels stay flat at rest; shadows are reserved for the public product shell, auth panels, overlays, drawers, dialogs, and floating notes.

### Shadow Vocabulary

- **Shadow 1** (`0 12px 28px -22px rgb(0 0 0 / 0.72)`): Low dark lift for subtle stacked affordances.
- **Shadow 2** (`0 26px 70px -44px rgb(0 0 0 / 0.9)`): Public product shell, auth panel, and raised frosted panels.
- **Overlay Shadow** (`0 28px 80px -30px rgb(0 0 0 / 0.94)`): Dialogs, drawers, menus, and modal layers.
- **Landing Product Lift** (`0 30px 80px -40px rgba(0,0,0,0.8)`): First-viewport product proof shell.
- **Floating Note Lift** (`0 20px 50px -30px rgba(0,0,0,0.9)`): Small floating notes attached to the public product shell.

### Named Rules

**The Frost Is Structure Rule.** Blur and translucency mark shell depth, overlays, and proof surfaces; they are not decoration for ordinary content.

**The Flat Work Panel Rule.** Daily operational panels stay border-led and shadowless unless they are actually stacked above the page.

## Shapes

The dark system uses modest but visible corners. Job boxes and dense fields use 0.5rem. Buttons, public cards, product-card interiors, image chips, and compact panels use 0.75rem. Auth panels, product shells, and important work panels use 1rem. Large public CTAs may use 1.5rem. Full pills are reserved for badges, eyebrows, dots, and compact status affordances. Active navigation keeps the three-pixel amber inset marker; it should not become a bulky selected card.

## Components

### Buttons

- **Shape:** Rounded technical command controls, usually 0.75rem with at least 2.5rem height.
- **Primary:** Amber signal fill, graphite text, fine amber-mixed border, and direct Turkish action labels.
- **Hover / Focus:** Hover moves to signal-hover and may rise by 1px where implemented; focus uses the same amber signal as a visible outline or field ring.
- **Secondary / Outline:** Transparent or panel background, ice text, line border, and a quiet hover border.
- **Danger:** Danger-soft background with danger text and mixed danger border; use only for destructive or failed states.

### Chips

- **Style:** Full-pill badges with semantic tint, matching text, and a border mixed with the semantic color and line.
- **State:** Pair color with explicit Turkish state text; color alone must never carry workflow meaning.
- **Scope:** Chips describe assignments, reports, subscriptions, validation, approval, draft, return, or platform states.

### Cards / Containers

- **Corner Style:** Standard panels use 0.75rem to 1rem; public CTA panels may use 1.5rem.
- **Background:** Panel or panel-subtle over graphite; public and auth shell panels may use frost alpha with backdrop blur.
- **Shadow Strategy:** Flat for daily work panels; Shadow 2 for auth/product proof; overlay shadow for stacked UI.
- **Border:** One-pixel line or amber-mixed line is the primary separator.
- **Internal Padding:** Compact rows use 0.75rem to 1rem; public cards and panels use 1.75rem to 2rem.

### Inputs / Fields

- **Style:** Panel-subtle fill, line border, ice text, mist placeholder, compact corner, and IBM Plex Sans body type.
- **Focus:** Border changes to signal and adds a three-pixel signal-soft ring.
- **Error / Disabled:** Disabled fields use graphite-subtle and text-subtle; errors pair danger color with explanatory text.

### Navigation

Desktop app navigation is a dark rail with mist default links, panel-subtle hover, ice hover text, and amber active state with an inset three-pixel marker. Public navigation uses a frosted sticky header with Space Grotesk brand lockup, mist links, and ice hover. Mobile navigation uses amber menu controls and a blurred graphite scrim.

### Tables

Tables sit in bordered panel containers. Headers use panel-subtle with text-soft, rows use line dividers, and hover uses panel-muted. Preserve horizontal scroll for real data density rather than hiding columns without product intent.

### Auth Panel

Authentication panels are frosted working surfaces: panel color with alpha, 1rem radius, Shadow 2, blur, signal active mode tabs, and field-level amber focus. On narrow screens, the panel becomes the primary page with no decorative shell padding.

### Public Product Shell

The public product shell is the signature proof component. It uses frost, line borders, a 1rem outer radius, 0.75rem inner cards, amber step markers, a subtle top hairline, and real assignment-to-report labels. It must show actual workflow capability without fake customers, fabricated activity, or invented metrics.

### Organization Context

Brand lockups, workspace cards, account context, owner labels, and personnel identity blocks must keep organization and role context visible. Long names truncate safely. These elements must never imply or expose another organization.

## Do's and Don'ts

### Do:

- **Do** start every web surface from `frosted-system.css` and the landing-page `source-*` world.
- **Do** use Space Grotesk for public/display moments and IBM Plex Sans for product UI/body.
- **Do** keep organization, role, permission, read-only, report, return, and subscription context visible when it changes available actions.
- **Do** preserve keyboard focus, skip links, semantic controls, touch targets, responsive reflow, and reduced-motion behavior.
- **Do** represent loading, empty, error, success, warning, disabled, destructive, signed, returned, and read-only states explicitly.
- **Do** verify dark surfaces at desktop and narrow web widths before shipping UI changes.

### Don't:

- **Don't** reintroduce light enterprise pages, pale blue shells, or mismatched login/register themes.
- **Don't** use amber as decoration; it must communicate action, focus, route state, progress, proof, or semantic warning.
- **Don't** invent customer proof, testimonials, logos, activity feeds, metrics, records, or capabilities.
- **Don't** turn ordinary work panels into floating novelty dashboards when borders and panel tones already establish structure.
- **Don't** use semantic colors for non-semantic decoration.
- **Don't** hide permissions, tenant context, validation, report immutability, or workflow constraints to simplify a composition.
