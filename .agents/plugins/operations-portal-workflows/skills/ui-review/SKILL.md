---
name: ui-review
description: Use for reviewing UI changes for functional, usability, accessibility, and regression issues without redesigning the application.
---

# UI Review

Use this workflow for UI reviews of `operations-portal` web or mobile changes. Prioritize functional issues over subjective design preferences, and do not modify code unless the user explicitly asks for fixes.

## Project References

Read:

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/TESTING.md`
- `docs/SECURITY.md` when auth, permissions, tenant visibility, data exposure, or storage access may be affected

## Review Focus

Inspect responsive layout, desktop/mobile behavior, loading states, disabled states, empty states, error states, button feedback, accessibility, keyboard usability, labels, forms and validation, navigation, permission visibility, browser console errors, network errors, visual regressions, and accidental cross-tenant or cross-company data exposure.

## Workflow

1. Identify the reviewed UI scope, affected routes/screens/components, roles, permissions, and data sources.
2. Inspect changed UI code plus nearby state, validation, navigation, API, and data-access interactions needed to understand behavior.
3. Exercise or reason through responsive desktop and mobile behavior, including loading, disabled, empty, error, and permission-specific states.
4. Check accessibility, keyboard usability, labels, form validation, navigation feedback, browser console errors, and network errors where practical.
5. Check for visual regressions that affect usability or comprehension, not personal style preferences.
6. Check that UI changes do not reveal cross-tenant or cross-company data through labels, lists, exports, URLs, logs, or network responses.
7. Group findings as blocking, important, or minor. Include evidence and file locations for each finding.
8. Recommend the smallest corrective change that preserves the existing product style and patterns.
9. State skipped manual checks, unavailable runtime verification, and residual risk plainly.

Do not redesign the application unless explicitly requested.
