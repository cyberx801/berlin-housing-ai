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
- [ ] `/api/predictions/rent` proxy route (503 NOT_CONFIGURED default) + test
- [ ] Form UI: five groups, rail progress, error summary, FloorIndicator, Ortsteil select filtered by Bezirk, URL prefill, session draft, reset
- [ ] ResultPanel: all outcomes designed; `not_connected` live; `ok` rendered only in component tests from contract fixtures
- [ ] E2E Flow 1

## Slice 4 — Market explorer `/explore` (depends on: 0, 1)
- [ ] ExploreMap (MapLibre, dynamic, inline style, feature-state), WebGL fallback
- [ ] Filter rail, synced list (listbox semantics), search field filtering the list, info panel, URL state
- [ ] Mobile bottom sheet (List / Details)
- [ ] E2E Flow 3 (selection via list and keyboard; URL deep link)

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
- [ ] Versioned storage + external store + cross-tab sync + corrupt-data handling
- [ ] Add/replace/remove/clear (confirm), add-from-analysis, comparison table (desktop + mobile), €/m² from user data
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
