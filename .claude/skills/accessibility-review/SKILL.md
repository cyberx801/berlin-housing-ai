---
name: accessibility-review
description: Review Berlin Housing AI UI for WCAG 2.2 AA — keyboard access, semantic HTML, focus visibility, contrast, forms and errors, maps and charts alternatives, reduced motion. Use for any new or changed interactive component, page, map or chart, and before closing a slice.
---

# Accessibility review (WCAG 2.2 AA target)

Combine the automated scan with a manual pass. axe finds roughly a third of issues, so the manual steps aren't optional.

## 1. Automated
```bash
npx playwright test tests/e2e/a11y.spec.ts   # @axe-core/playwright on each route + key states
```
The target is 0 serious or critical violations. Moderate ones are listed in TASKS with a decision.

## 2. Keyboard (no mouse)
- Tab order follows the visual order. The skip link reaches `<main>`.
- Every control is reachable and operable: Enter/Space for buttons, arrow keys inside radio groups, comboboxes and listboxes, Esc closes dialogs, popovers and the mobile nav.
- Focus is always **visible** (2 px focus token, 2 px offset). Focus is never hidden behind the sticky header or bottom sheet (2.4.11).
- Dialogs trap focus and return it to the trigger. After route changes and form submit, focus goes somewhere sensible: the error summary or the result heading.
- **Map:** everything on the MapLibre map can also be done from the synced list. The canvas isn't the only path. On the SVG plate, the list alternative is linked and announced.
- **Charts:** a focusable chart with arrow keys moving between points or marks, the value announced, and a "Show table" alternative.

## 3. Semantics and names
- Landmarks: one `<header>`, `<nav aria-label>`, `<main>`, `<footer>`. The legend rail is `<aside aria-label="Legend and sources">`.
- Heading levels don't skip. Each page has one `<h1>`.
- Every input has a `<label>`. Required or optional is said in text. Hints and errors are linked via `aria-describedby`. Errors use `aria-invalid`.
- Radio groups use `fieldset` + `legend`, which covers segmented controls and tri-states.
- Icon-only buttons have an accessible name. Decorative SVG is `aria-hidden`. The plates have `role="img"` plus an `aria-label` summary, or a described group.
- Live regions announce form results, a cleared Ortsteil after a Bezirk change, comparison changes and filter result counts (`aria-live="polite"`).

## 4. Visual
- Text contrast is ≥ 4.5:1 (≥ 3:1 for large text). UI components and meaningful graphics are ≥ 3:1. Use the computed values in DESIGN_SYSTEM §2. Any new color pair must be computed, not eyeballed.
- State is never conveyed by color alone: selection has an outline and text, errors have an icon and text, and provenance has words.
- At 400 % zoom (320 CSS px) and with text spacing overrides: no loss of content and no two-dimensional scrolling, except for maps and charts.
- Targets are ≥ 24 × 24 px (2.5.8). Primary controls are ≥ 44 px.

## 5. Motion and preferences
- `prefers-reduced-motion`: no ring draw-in, instant map moves, no transitions over 0 ms.
- `forced-colors`: borders and focus stay visible, and chart texture turns on (DESIGN_SYSTEM §8.5).

## 6. Forms (from WCAG 3.3.x)
- An error summary appears on submit with links to the fields. Messages name the fix.
- Users can't lose input: a session draft, and confirmation before reset or clear.
- No time limits. Redundant entry is avoided: the compare dialog can import from the analysis (3.3.7).

## 7. Screen reader smoke test
Run whatever screen reader is available (NVDA + Firefox on Windows if installed; VoiceOver on macOS/iOS). Complete Flow 1 (analyze → not-connected result) and Flow 3 (explore via list). Record which reader and browser were used, and what failed.

## Report
Add findings to `docs/implementation/TASKS.md` under the slice, each with its WCAG criterion, severity and fix status.
