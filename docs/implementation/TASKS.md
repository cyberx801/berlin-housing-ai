# Implementation Tasks

Status legend: `[x]` done · `[~]` in progress · `[ ]` todo · `[!]` blocked (reason given)
Last updated: 2026-10-29

**Definition of done for every slice**
1. `npm run typecheck`, `npm run lint` and `npm run test` pass. `npm run build` passes from slice 1 onward.
2. The slice's E2E journey and its axe scan pass at 375, 768 and 1440 px.
3. Screenshots are reviewed by eye against DESIGN_SYSTEM using the `design-system` skill, and the issues found are fixed or logged here.
4. The `accessibility-review` skill checklist has been run for any new interactive component.
5. This file and DECISIONS are updated. Any check that was skipped is stated, never implied.

---

## Phases 1–3 — Specification, design, architecture
- [x] Repository and environment audit (no existing project; Node 22.16, npm 10.9, git 2.50; no Python on PATH)
- [x] Official geodata located, licensed (dl-de/zero-2.0), retrieved, checksummed, and its quality checked
- [x] PRD, user flows, three design concepts, selected direction, design system with validated palette
- [x] Frontend architecture, data boundaries, prediction contract (draft), decision log
- [x] Project skills: `design-system`, `frontend-quality`, `accessibility-review`
- [~] **Client review of the design direction** (Atlas). The owner said to proceed with implementation ("devam et"); a formal review of the built pages is still welcome and can change the direction.

## Slice 0 — Data foundation (depends on: nothing)
- [x] `scripts/build-geo.mjs`: mapshaper pipeline, derivations and asserts (DATA_BOUNDARIES §6, ARCH §6)
- [x] Generated `src/lib/data/geo/generated/*` + `public/geo/*`; size budgets asserted
- [x] Slug rule lives in `scripts/lib/geo-derive.mjs` (slugs are build output, not computed at runtime) + unit tests
- [x] Geo build tests (12 / 97, mapping, symmetry, area consistency, d3 winding): `tests/unit/geo-derive.test.ts`, `tests/unit/geo-data.test.ts`

## Slice 1 — Project foundation and design system (depends on: 0 for the geo types)
- [x] Scaffold Next 16 (App Router, TS strict, Tailwind v4, ESLint flat), versions pinned and verified (D-024)
- [x] `next.config.ts`: `turbopack.root`, `outputFileTracingRoot`, cacheComponents; root layout `ensureStatic` (D-027)
- [x] Tokens in `globals.css` `@theme` (light; dark tokens documented, not shipped), fonts via `next/font` (Archivo wdth 62–125 verified in the built `@font-face`, Source Serif 4 opsz)
- [x] UI primitives: Button, Field, Select, ChoiceGroup, Disclosure, StatusPanel, Dialog (native, D-026)
- [x] Provenance: `Provenance` type (D-029), ProvenanceMark, ProvenanceLabel, Plate
- [x] Vitest + Testing Library wired up (82 tests passing); Playwright config + Chromium installed; `npm run check`
- [x] ESLint boundary rules (negative-tested with probe files) + `tests/unit/boundaries.test.ts`
- [~] `.env.example` done; README setup to be verified on a clean install in slice 9

## Slice 2 — App shell and homepage (depends on: 1; design gate)
- [x] SiteHeader (sticky, current-page state, mobile disclosure nav that closes on route change and Esc), skip link, SiteFooter (sources, licenses)
- [x] LegendRail + `page-grid` utility (12/8/4 columns, verified in compiled CSS)
- [x] RingPlate (SVG, server) + RingPlateExplorer (hover/tap, grouped select, readout, `<use>` highlight layer); ring draw-in once per session, off under reduced motion
- [x] AnalysisEntry (GET form to `/analyze?bezirk=<slug>&area=&rooms=`, shared Zod messages), tools ledger, Bezirk small multiples on one scale, explorer preview (LocatorPlate), data-truth ledger
- [x] not-found and error pages
- [x] E2E: `tests/e2e/home.spec.ts` + `tests/e2e/shell.spec.ts` at 375/768/1440 (41 passed, 1 skipped by design: mobile menu at 1440)
- [x] Geo build: Bezirk borders as a shared-edge mesh (`-innerlines`) and Berlin outline, so each border is stroked once

**Slice 2 checks (2026-10-29):** `npm run typecheck` ✓, `npm run lint` ✓, `npm run test` 84/84 ✓, `npm run build` ✓, `npx playwright test` 41 passed / 1 skipped ✓.

**Payload:** `/` HTML is 266 kB raw / ~63 kB gzip. The Ring Plate is 37 kB of SVG, paid twice (HTML + RSC flight data), so ≈ 75 kB against the 90 kB budget. Silhouettes use whole-pixel coordinates. Possible later cut: draw the home locator as `<use>` of the hero paths.

**Design review findings (screenshots 375/768/1440):**
- Fixed: `display-1` at 6.5rem set the hero title on five lines and outweighed the plate. Now `clamp(2.5rem, 1.25rem + 3vw, 4rem)` (DESIGN_SYSTEM §3 updated).
- Fixed: the hero grid split the plate's extra height between both rows, leaving a gap above the entry form (`grid-rows-[auto_1fr]`).
- Fixed: the licence id broke at its hyphen on mobile (`dl-` / `de/zero-2.0`).
- Verified: no horizontal scroll at 320, 375, 768 and 1440 px; the highlight overlay registers exactly with the plate.
- Verified in a browser: `vector-effect: non-scaling-stroke` breaks `pathLength` dashes, so the ring draw-in reveals the ring through a thick scaling mask stroke instead.

**Accessibility review (slice 2):**
- axe (wcag2a/aa, 2.1, 2.2 tags): 0 violations on `/` and the 404 page at all three widths.
- Keyboard: skip link first and moves focus to `<main>`; mobile menu has `aria-expanded`, closes on Esc and route change, returns focus; plate keyboard path is the grouped native select (D-031) with a polite live region.
- 2.4.11 Focus not obscured: fixed with `scroll-padding-top` on `html`; E2E tabs backwards and checks no focused element sits under the sticky header.
- Forced colors (emulated): fixed the primary button (no outline) and the solid provenance marks (drawn with backgrounds, now borders). The SVG plate keeps its own colors and stays legible.
- 2.5.8 Target size: small Ortsteil paths on the mobile plate are below 24 px; the equivalent select satisfies the exception.
- The home entry has 3 fields, so it focuses the first invalid field with inline errors instead of an error summary. The full form on `/analyze` gets the summary (slice 3).
- [!] Screen-reader smoke test **skipped**: NVDA isn't installed on this machine and Firefox isn't either. To be run in slice 9 or by the owner.

## Slice 3 — Property analysis and integration boundary (depends on: 1; uses 0 for options)
- [x] `lib/validation/property.ts` (UI schema + refinements + messages) + tests
- [x] `lib/contracts/rent-prediction.v1.ts` (DRAFT request, response, error) + `toRentPredictionRequest` + tests
- [x] `lib/api/prediction`: config (env Zod), DisabledTransport, HttpTransport, service + contract tests over `tests/contracts/fixtures/*` (found and fixed: major-version check was unreachable; non-JSON 5xx bodies were not retryable)
- [x] `/api/predictions/rent` proxy route (503 NOT_CONFIGURED default; 400/413/422 before any upstream call; 502/504 on upstream failure; key only upstream) + `tests/unit/prediction-proxy.test.ts` (D-036)
- [x] Form UI: five groups with "n of m answered", rail progress (sticky at `lg`) and mobile progress strip (D-035), error summary (D-032), FloorIndicator, Ortsteil select filtered by Bezirk (or grouped, filling in the Bezirk), URL prefill applied once (D-034), session draft, Start over with confirmation
- [x] ResultPanel: every outcome designed (`not_connected` ×2 reasons, `ok`, `rejected`, `unavailable` with retry, `invalid_input`); `not_connected` is what ships; `ok` is rendered only in `tests/component/result-panel.test.tsx` from contract fixtures read off disk
- [x] "Add to comparison" writes to the comparison store (slice 7 builds the page)
- [x] E2E Flow 1: `tests/e2e/analyze.spec.ts` (homepage → prefilled form → not-connected result, error summary, invalid link values, Bezirk change, reload + Start over, focus not obscured, axe)
- [x] `randomId()` with a `getRandomValues` fallback: `crypto.randomUUID` throws outside secure contexts (e.g. the dev server opened from a phone at a LAN address)

**Slice 3 checks (2026-10-29):** `npm run typecheck` ✓, `npm run lint` ✓ (0 problems), `npm run test` 158/158 ✓ (13 files), `npm run build` ✓ (`/analyze` static, `/api/predictions/rent` dynamic), `npx playwright test` 62 passed / 1 skipped ✓ (skip: mobile menu at 1440, by design).

**Bugs found while testing (fixed):**
- Cross-field errors (floor above total floors, Ortsteil outside the Bezirk) never showed while any required field was empty, because Zod skips object refinements once a field has an issue. They now use `when` (D-033).
- Leaving the property type radios without choosing made React Hook Form store `null`, which showed Zod's raw "Invalid input: expected string, received null" in the summary. It would also have made the session draft unreadable on reload. Property type is now a controlled group, and the schema has field messages for type errors.
- At 1440 px, pressing "Prepare analysis" while an invalid field was focused lost the click: blur validation inserted an error and moved the button 27 px between pointer-down and pointer-up. Validation now starts on submit (D-033).
- Pressing submit before hydration does nothing (React drops it). E2E tests wait for `form[data-hydrated]`. **Open:** a real user on a slow phone gets no feedback in that window; to be handled in slice 9.

**Design review findings (screenshots 375/768/1440: prefilled, error summary, result):**
- Fixed: the empty FloorIndicator wrapper still took a column and narrowed "Total floors".
- Fixed: the "Filled in from the link" notice stayed on screen under the result; a prepared result now replaces it.
- Verified: no horizontal scroll in any of the three states at any width; one bold element per screen (the result heading, or the summary).

**Accessibility review (slice 3: form, error summary, result panel, Start over dialog):**
- axe (wcag2a/aa, 2.1, 2.2): 0 violations on first load, with the error summary, with the result, and with the dialog open, at 375, 768 and 1440 px.
- Keyboard: after a prefill, focus is on the first empty required field; Space picks a radio; summary links move focus to their fields; the result heading takes focus after submit; Esc closes the dialog and focus returns to "Start over".
- 2.4.11 Focus not obscured: E2E tabs backwards through the whole form at three widths, under both the header and the mobile strip (D-035).
- Live regions: Ortsteil cleared, Bezirk filled in, draft restored, invalid link values, "Analysis prepared." and the comparison status (`role="status"`).
- Forced colors (emulated): **fixed** `ChoiceGroup` (slice 1 component). The selected pill kept only its font weight, because fill and inset shadow are dropped. It now opts out with `forced-color-adjust: none` and uses Highlight / HighlightText. The floor indicator marks the chosen floor in Highlight.
- 2.5.8: the strip's "Prepare analysis" is 36 px (dense rail size, ≥ 24 px); quiet buttons are ≥ 24 px.
- [!] Screen-reader smoke test of Flow 1 **skipped**: NVDA and Firefox are still not installed.

## Slice 4 — Market explorer `/explore` (depends on: 0, 1)
- [x] ExploreMap: MapLibre via `next/dynamic` after a WebGL2 check, inline style, `promoteId: "code"`, feature-state for selection, hover and filter dimming, HTML labels, own zoom buttons and attribution (D-038)
- [x] WebGL2 fallback: the server-rendered plate, with an explanation and pointer selection; the plate also stands in while the map loads
- [x] Filter rail (search, Bezirk, ring status), listbox with `aria-activedescendant` grouped by Bezirk, details panel (facts, bordering Ortsteile, Analyze and profile links, Esc), URL state `o`/`bezirk`/`ring`/`q` (D-037)
- [x] Below `lg`: map at 55 % above a List / Details tablist and a self-scrolling sheet (D-039)
- [x] E2E Flow 3: `tests/e2e/explore.spec.ts` (search and keyboard selection, shared link and reload, unknown slug, map click, filters and URL, forced fallback without the map module, leave and return with one canvas, axe)
- [ ] Demo choropleth behind "Show demo layer" (PRD C6): waits for the slice 5 fixtures
- [ ] "Open the … profile" links to `/neighborhoods/<slug>`, which returns 404 until slice 6 (as on the homepage)

**Slice 4 checks (2026-10-29):** `npm run typecheck` ✓, `npm run lint` ✓ (0 problems), `npm run test` 182/182 ✓ (15 files; new: `explore-filters`, `explore-view`), `npm run build` ✓ (`/explore` static), `npx playwright test` 83 passed / 1 skipped ✓ (skip: mobile menu at 1440, by design). In the browser: worker and the three GeoJSON files load with 200, no console errors; the static HTML has all 97 options and no MapLibre reference.

**Bugs found while testing (fixed):**
- The map drew nothing. MapLibre's unlayered `.maplibregl-map { position: relative }` beat Tailwind's layered `absolute`, so the container had no height. It now fills a positioned wrapper (D-038).
- With an `error` listener attached, MapLibre stops logging, and a later `idle` turned a failed source into "ready". Errors are now logged, and a failed source stays failed.
- "Clear filters" waited 400 ms to update the URL, because it also clears the query. Only typing in the search field is delayed now.
- `npm run lint` linted the copied MapLibre worker (1103 warnings). `public/vendor/**` is now ignored.

**Design review findings (screenshots 375/768/1024/1440):**
- Fixed: a selected Ortsteil filled the whole map and its neighbours disappeared. Fits now keep 15 % of the map as surroundings, up to zoom 13.
- Fixed: at `lg` the explorer was viewport-tall below the title, so the map's bottom and the attribution needed a scroll. It now fits under the title.
- Fixed: labels were cut off under the details panel and the attribution line. Both strips now count as off-map for labels.
- Verified: no horizontal scroll at any width, one bold element per screen (the marker-filled selection), and the official band on the map frame and the details panel.

**Accessibility review (slice 4: list, filters, details, tabs, map):**
- axe (wcag2a/aa, 2.1, 2.2): 0 violations after a keyboard selection, after a map click, and in the WebGL2 fallback, at 375, 768 and 1440 px.
- Keyboard:
  - Search, then ArrowDown into the list. Arrow keys, Home, End and Page keys move the active option, and Enter or Space selects. Selection does not follow focus.
  - Esc closes the details, and focus returns to the list if it was in the panel. A bordering-Ortsteil button moves focus to the new heading.
  - Below `lg`, arrow keys switch tabs, and focus follows a selection into Details only when the list hides.
- The map is never the only path: the list and the details panel carry everything the map shows. Map labels are `aria-hidden`. The canvas is labelled, and its focus ring is drawn inside it.
- Live region: selection, cleared selection and filter result counts (search counts after a pause).
- Forced colors (emulated): the selected option paints itself in Highlight / HighlightText with "Selected" in text. The active option's focus ring stays visible.
- 2.4.11: the active option at 375 px sits between the map and the bottom edge, clear of the header (checked in the browser).
- Targets: options and tabs are 44 px, map buttons 36 px, and bordering-Ortsteil links at least 24 px.
- [!] The map canvas keeps its token colours under forced colors (canvas isn't adjusted). The plate and the list follow system colours.
- [!] Screen-reader smoke test of Flow 3 **skipped**: NVDA and Firefox are still not installed.

## Slice 5 — Market intelligence `/market` (depends on: 1)
- [ ] `scripts/build-demo-fixtures.mjs` (seeded) + `fixtures/demo/README.md`
- [ ] `MarketDataSource` + `demo-source` + boundary test
- [ ] Chart primitives (Line, Bar, Histogram, DotPlot) + TableView + tooltip/keyboard; in-SVG demo label
- [ ] Filters (≤ 4 Bezirke rule), URL state, module error boundaries
- [ ] E2E Flow 4

## Slice 6 — Neighborhoods (depends on: 0, 2)
- [ ] Directory with filters/search/URL state; empty state
- [ ] `[slug]` SSG (97), LocatorPlate, facts ledger, adjacent comparison, honest modules (market demo / transit not connected / character pending)
- [ ] E2E Flow 2; 404 for unknown slug

## Slice 7 — Compare (depends on: 3)
- [x] Versioned storage + external store + cross-tab sync + corrupt-data handling (built in slice 3: `features/property-comparison/store.ts`, `tests/unit/compare-store.test.ts`)
- [~] Add-from-analysis (the action on `/analyze` is built; the asking-rent prompt on `/compare` is not)
- [ ] Add/replace/remove/clear (confirm), comparison table (desktop + mobile), €/m² from user data
- [ ] E2E Flow 5 (persist across reload)

## Slice 8 — Methodology (depends on: 0, 3, 5)
- [ ] Sections mirroring the PRD §3 truth table; dataset registry rendered from `data/PROVENANCE` metadata; ring/area/adjacency method; uncertainty explainer
- [ ] All provenance band links resolve to anchors

## Slice 9 — Responsive polish and QA (depends on: all)
- [ ] Screenshot review at 375/768/1440 for every route and key state; fix list
- [ ] Full keyboard and screen-reader pass (NVDA + Firefox if installed; VoiceOver if available; record which was used)
- [ ] Dark mode: ship only if every token check passes; otherwise force light (D-020)
- [ ] Performance budgets checked (Lighthouse mobile)
- [ ] Final QA report: commands run, results, known gaps

## Blocked / external
- [!] Real market data: waiting for the Kaggle files + URL/license (PRD Q1)
- [!] Contract v1 freeze: waiting for the ML feature schema (PRD Q2/Q3)
