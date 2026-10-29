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
- [ ] RingPlate (SVG, server) + interaction wrapper; ring draw-in respecting reduced motion
- [ ] AnalysisEntry (Bezirk / area / rooms → `/analyze?…`), tools Ledger, Bezirk small multiples, explorer preview, data-truth ledger
- [x] not-found and error pages
- [ ] E2E: home renders, entry navigates with params, keyboard path through plate list

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
