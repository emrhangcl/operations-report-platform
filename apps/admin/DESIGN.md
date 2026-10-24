---
name: Operasyon Portalı Admin
description: Dark Frosted Technical control surface for tenant-scoped field and office work.
colors:
  background: "oklch(0.196 0.014 259)"
  background-subtle: "oklch(0.218 0.016 259)"
  card: "oklch(0.246 0.018 259)"
  card-raised: "oklch(0.272 0.02 259)"
  card-subtle: "oklch(0.226 0.017 259)"
  muted: "oklch(0.286 0.019 259)"
  border: "oklch(0.332 0.021 258)"
  border-strong: "oklch(0.405 0.024 258)"
  foreground: "oklch(0.955 0.006 250)"
  foreground-soft: "oklch(0.86 0.012 250)"
  muted-foreground: "oklch(0.671 0.023 250)"
  subtle-foreground: "oklch(0.57 0.025 250)"
  primary: "oklch(0.775 0.152 71)"
  primary-hover: "oklch(0.83 0.145 76)"
  primary-soft: "oklch(0.775 0.152 71 / 0.13)"
  primary-foreground: "oklch(0.196 0.014 259)"
  ring: "oklch(0.775 0.152 71)"
  destructive: "oklch(0.72 0.16 25)"
  destructive-hover: "oklch(0.78 0.16 25)"
  destructive-soft: "oklch(0.58 0.15 25 / 0.16)"
  success: "oklch(0.79 0.12 160)"
  success-soft: "oklch(0.58 0.1 160 / 0.16)"
  warning: "oklch(0.82 0.14 76)"
  warning-soft: "oklch(0.68 0.14 76 / 0.16)"
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
  lg: "1rem"
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
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "0.625rem 1.25rem"
    height: "2.625rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0.625rem 1.25rem"
    height: "2.625rem"
  input:
    backgroundColor: "{colors.card-subtle}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.sm}"
    padding: "0.625rem 0.75rem"
    height: "2.5rem"
  panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "1rem"
  nav-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    height: "2.5rem"
---

# Design System: Operasyon Portalı Admin

## Overview

**Creative North Star: "Frosted Technical Operations"**

Operasyon Portalı Admin now belongs to the first-open landing screen's dark technical world. The system is graphite first: a low-glare operational canvas, translucent dark panels, fine steel borders, ice text, mist support copy, and a single amber accent for the primary action, active navigation, and focus. Every public, authentication, admin, owner, and personnel web surface should feel like one continuous operating environment rather than a jump between marketing and product skins.

The design should stay technical, compact, and calm. Frost is a material layer for sticky headers, authentication panels, drawers, dialogs, and the public product shell; it is not decorative glass. Product truth, role context, organization boundaries, report integrity, and permission state remain more important than atmosphere.

**Key Characteristics:**

- Graphite canvas with dark panel layering across public and authenticated routes.
- Amber primary reserved for the primary action, active navigation, and focus.
- Ice text and mist support copy create hierarchy without returning to a light enterprise surface.
- Space Grotesk is public/display voice; IBM Plex Sans is the operational UI and body voice.
- Borders, translucent panels, blur, and restrained shadow build depth without decorative dashboard novelty.
- Turkish operational copy stays direct, role-safe, tenant-aware, and grounded in real workflows.

## Colors

Colors are semantic theme tokens in the shadcn/ui vocabulary, written as plain CSS custom properties in `app/theme-tokens.css` (no Tailwind, no component library). The frontmatter is normative. Today only the dark set exists and it reproduces the original graphite values exactly; a light set will use the same token names.

### Surfaces

- **Background / Background Subtle:** The full-page canvas; the subtle step for sticky bars, public bands, and disabled fields.
- **Card / Card Raised / Card Subtle:** Standard working surface; dialogs and raised layers; field backgrounds and nested containers.
- **Muted:** Hover rows, disabled tracks, and quiet state surfaces.
- **Border / Border Strong:** Default one-pixel structure; stronger dividers and scrollbar thumbs.

### Text

- **Foreground:** Primary text, headings, and operational values.
- **Foreground Soft:** Table headers and intermediate copy.
- **Muted Foreground / Subtle Foreground:** Supporting copy and metadata; faint placeholder-level copy.

### Accent

- **Primary:** Operational amber. **Primary Foreground** is the text on a primary fill. **Primary Soft** is the selected-state background. **Ring** is the focus ring (same amber).

### Status

- **Destructive:** Delete actions and failed or blocked states.
- **Success:** Completed, approved, and valid states.
- **Warning:** Draft, pending, subscription grace, and caution states.
- **Info:** Informational system messages.
- Each status has a `-soft` tint for chips and notices.

### Radius

One scale: `--radius` (0.75rem) with `--radius-sm` (0.5rem) and `--radius-lg` (1rem) derived from it.

### Legacy aliases

Older variables stay as aliases so class names and markup do not change. New CSS uses the theme tokens directly.

| Legacy | Token |
|---|---|
| `--op-bg`, `--op-bg-subtle` | `--background`, `--background-subtle` |
| `--op-surface`, `--op-surface-raised`, `--op-surface-subtle`, `--op-surface-muted` | `--card`, `--card-raised`, `--card-subtle`, `--muted` |
| `--op-text`, `--op-text-soft`, `--op-text-muted`, `--op-text-subtle` / `--op-text-faint` | `--foreground`, `--foreground-soft`, `--muted-foreground`, `--subtle-foreground` |
| `--op-border`, `--op-border-strong` | `--border`, `--border-strong` |
| `--op-primary`, `--op-primary-hover`, `--op-primary-soft`, `--op-accent`, `--op-ring` | `--primary`, `--primary-hover`, `--primary-soft`, `--primary`, `--ring` |
| `--op-danger`, `--op-danger-hover`, `--op-danger-soft` | `--destructive`, `--destructive-hover`, `--destructive-soft` |
| `--op-success`, `--op-warning`, `--op-info` (+ `-soft`) | `--success`, `--warning`, `--info` (+ `-soft`) |
| `--source-graphite`, `--source-panel`, `--source-line`, `--source-mist`, `--source-signal`, `--source-signal-hover`, `--source-ice` | `--background`, `--card`, `--border`, `--muted-foreground`, `--primary`, `--primary-hover`, `--foreground` |

The old text-color variable `--muted` is now `--muted-text`; `--muted` is the shadcn surface token.

### Named Rules

**The Single Accent Rule.** Primary (amber) marks only the primary button, the active navigation item, and the focus ring. Page titles, section titles, form labels, table headers, and links are neutral (foreground or muted foreground). One primary button per page; on mobile it is full width and at least 44px tall. Existing screens that still use amber elsewhere are migrated page by page.

**The Semantic Color Rule.** Green means a positive state only; a zero count is not a success. Red (destructive) means a destructive action or a failed state only. "Add" style actions are secondary (neutral outline), never red. Inline row deletes use a ghost icon button; a filled destructive button appears only inside the confirmation dialog.

**The Color Is Not Alone Rule.** Status color always comes with explicit Turkish text or an icon.

**The First-Viewport Authority Rule.** New web surfaces inherit the theme tokens before local styling decisions.

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

- **Do** start every web surface from the theme tokens in `theme-tokens.css`; use legacy `--op-*` / `--source-*` names only in existing rules.
- **Do** use Space Grotesk for public/display moments and IBM Plex Sans for product UI/body.
- **Do** keep organization, role, permission, read-only, report, return, and subscription context visible when it changes available actions.
- **Do** preserve keyboard focus, skip links, semantic controls, touch targets, responsive reflow, and reduced-motion behavior.
- **Do** represent loading, empty, error, success, warning, disabled, destructive, signed, returned, and read-only states explicitly.
- **Do** verify dark surfaces at desktop and narrow web widths before shipping UI changes.

### Don't:

- **Don't** reintroduce light enterprise pages, pale blue shells, or mismatched login/register themes.
- **Don't** use amber for titles, labels, table headers, or links; it marks the primary action, active navigation, and focus only.
- **Don't** invent customer proof, testimonials, logos, activity feeds, metrics, records, or capabilities.
- **Don't** turn ordinary work panels into floating novelty dashboards when borders and panel tones already establish structure.
- **Don't** use semantic colors for non-semantic decoration.
- **Don't** hide permissions, tenant context, validation, report immutability, or workflow constraints to simplify a composition.
