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

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#2563EB` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#047857` | `--color-secondary` |
| On Secondary | `#000000` | `--color-on-secondary` |
| Accent/CTA | `#1D4ED8` | `--color-accent` |
| On Accent/CTA | `#FFFFFF` | `--color-on-accent` |
| Background | `#F8FAFC` | `--color-background` |
| Foreground | `#1E293B` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Card Foreground | `#1E293B` | `--color-card-foreground` |
| Muted | `#E9EFF8` | `--color-muted` |
| Muted Foreground | `#475569` | `--color-muted-foreground` |
| Border | `#E2E8F0` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| On Destructive | `#FFFFFF` | `--color-on-destructive` |
| Ring | `#2563EB` | `--color-ring` |

**Color Notes:** Neutral surfaces, trust blue for primary actions, and restrained teal for positive operational states. Status meaning must never rely on color alone.

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
