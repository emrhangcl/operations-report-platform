# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Operations Portal
**Generated:** 2026-08-31 11:54:27
**Category:** Multi-tenant Operations SaaS
**Design Dials:** Variance 3/10 (Restrained) | Motion 2/10 (Functional only) | Density 8/10 (Dense / Dashboard)

---

## Global Rules

### Color Palette

Source of truth: `apps/admin/app/theme-tokens.css` and `apps/admin/DESIGN.md` (direction "Calm Operations": shadcn/ui token vocabulary in plain CSS, current graphite/amber identity kept). Only the dark set exists today; a light set will reuse the same names.

| Role | Dark value | CSS Variable |
|------|------------|--------------|
| Background | `oklch(0.196 0.014 259)` | `--background` |
| Background Subtle | `oklch(0.218 0.016 259)` | `--background-subtle` |
| Card | `oklch(0.246 0.018 259)` | `--card` |
| Card Raised | `oklch(0.272 0.02 259)` | `--card-raised` |
| Card Subtle | `oklch(0.226 0.017 259)` | `--card-subtle` |
| Muted (surface) | `oklch(0.286 0.019 259)` | `--muted` |
| Border | `oklch(0.332 0.021 258)` | `--border` |
| Border Strong | `oklch(0.405 0.024 258)` | `--border-strong` |
| Foreground | `oklch(0.955 0.006 250)` | `--foreground` |
| Foreground Soft | `oklch(0.86 0.012 250)` | `--foreground-soft` |
| Muted Foreground | `oklch(0.671 0.023 250)` | `--muted-foreground` |
| Subtle Foreground | `oklch(0.57 0.025 250)` | `--subtle-foreground` |
| Primary (amber) | `oklch(0.775 0.152 71)` | `--primary` (+ `-hover`, `-soft`) |
| On Primary | `oklch(0.196 0.014 259)` | `--primary-foreground` |
| Focus Ring | `= --primary` | `--ring` |
| Destructive | `oklch(0.72 0.16 25)` | `--destructive` (+ `-hover`, `-soft`) |
| Success | `oklch(0.79 0.12 160)` | `--success` (+ `-soft`) |
| Warning | `oklch(0.82 0.14 76)` | `--warning` (+ `-soft`) |
| Info | `oklch(0.78 0.1 225)` | `--info` (+ `-soft`) |
| Radius | `0.75rem` | `--radius` (`--radius-sm`, `--radius-lg`) |

**Single accent rule:** amber (`--primary`) marks only the primary button, the active navigation item, and the focus ring. Titles, labels, table headers, and links are neutral. One primary button per page.

**Semantic color rule:** green only for positive states (a zero count is not success); red (`--destructive`) only for destructive actions and failed states; "Add" actions are neutral secondary buttons. Inline deletes are ghost icon buttons; filled destructive only inside the confirmation dialog. Status meaning must never rely on color alone.

Legacy variables (`--op-*`, `--source-*`) are aliases of these tokens; see the alias table in `apps/admin/DESIGN.md`.

### Typography

- **Heading Font:** Inter
- **Body Font:** Inter
- **Mood:** calm, precise, professional, operational
- **Fallback:** system UI sans-serif stack

Use the application font stack defined by `--op-font-sans`; do not add a remote font dependency.

### Spacing Variables

*Density: 8/10 — Dense / Dashboard*

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `2px` / `0.125rem` | Tight gaps |
| `--space-sm` | `4px` / `0.25rem` | Icon gaps, inline spacing |
| `--space-md` | `8px` / `0.5rem` | Standard padding |
| `--space-lg` | `12px` / `0.75rem` | Section padding |
| `--space-xl` | `16px` / `1rem` | Large gaps |
| `--space-2xl` | `24px` / `1.5rem` | Section margins |
| `--space-3xl` | `32px` / `2rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: #1D4ED8;
  color: white;
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: 600;
  transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  background: #1E40AF;
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: #2563EB;
  border: 1px solid #CBD5E1;
  padding: 12px 24px;
  border-radius: 6px;
  font-weight: 600;
  transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: #FFFFFF;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.card:hover {
  border-color: #CBD5E1;
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 6px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #2563EB;
  outline: none;
  box-shadow: 0 0 0 3px #2563EB20;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: none;
}

.modal {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Calm enterprise operations

**Keywords:** restrained, dense, legible, neutral surfaces, strong hierarchy, fast scanning

**Best For:** Daily operational work across platform owner, company owner, manager, and personnel roles

**Key Effects:** One-pixel borders, shallow elevation, compact controls, persistent navigation, explicit status labels

### Page Pattern

**Pattern Name:** Application shell + dense workspace

- **Interaction Strategy:** Keep the primary operational action visible in the page header, preserve routes and filter state, and show loading/error/empty feedback in context.
- **Action Placement:** Page header primary action; row-level actions grouped at the end of tables.
- **Section Order:** Page header > filters/summary > form or data view > contextual feedback.

---

## Motion

Use only short state transitions (120-180ms) for hover, focus, menus, dialogs, and navigation feedback. Do not animate table rows or page sections. Respect `prefers-reduced-motion` globally.

---

## Anti-Patterns (Do NOT Use)

- ❌ Excessive animation
- ❌ Dark mode by default
- ❌ Glassmorphism or blurred application surfaces
- ❌ Decorative gradients and colored blobs
- ❌ Oversized typography or landing-page composition inside authenticated routes
- ❌ Large rounded cards, nested cards, or card grids used as page sections

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
