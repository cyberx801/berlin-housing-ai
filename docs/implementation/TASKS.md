# Implementation Tasks

Status legend: `[x]` done · `[~]` in progress · `[ ]` todo · `[!]` blocked (reason given)
Last updated: 2026-10-30

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
- [x] "Open the … profile" links to `/neighborhoods/<slug>`. The profiles exist since slice 6.

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
- [x] `scripts/build-demo-fixtures.mjs` (seed `20261029`, `--check` mode) + `src/lib/fixtures/demo/README.md`. Every parameter is a random draw, with no real-world ordering, and the four empty combinations are deliberate (D-041). Registered in `data/PROVENANCE.md`.
- [x] `MarketDataSource` + `demo-source` + boundary tests. Fixtures are imported only by the demo source, and the demo source only from `src/lib/data/market`. Default view prerendered; other filters go through `GET /api/market/*` (D-022 resolved).
- [x] Chart primitives:
  - `LineChart`, `BarChart`, `Histogram` and `DotPlot` on a shared `ChartFrame`: measured, with one slider per chart, a tooltip with Esc, and the in-SVG demo label (D-042)
  - `TableView` in a native "Show table" disclosure
  - `ChartLegend` for 2+ series, plus direct end labels
- [x] Filters:
  - Bezirke ≤ 4, colour slots that follow the entity, and a 5th Bezirk refused with a reason; period in years; property type
  - Per-module scope sentences (D-040), URL state `bezirke`/`from`/`to`/`type`, cleaning of unusable links
  - Module loading, empty and error states with "Try again", and per-module render boundaries
- [x] E2E Flow 4: `tests/e2e/market.spec.ts`. It covers filter and reload, the table view, the 5th Bezirk, the empty state and its way out, keyboard readout, a 400 on a bad API query, and axe with no horizontal scroll.
- [ ] Demo choropleth behind "Show demo layer" on `/explore` (PRD C6). Still not built: it is optional ("allowed"), and moved to slice 9.
- [ ] `/methodology#market-data`, the target of every "How this is calculated" link, returns 404 until slice 8.

**Slice 5 checks (2026-10-29):**
- `npm run typecheck` ✓
- `npm run lint` ✓ (0 problems)
- `npm run test` 219/219 ✓ (19 files; new: `demo-market`, `market-query`, `market-routes`, `market-view`, plus a boundary case)
- `npm run fixtures:build -- --check` ✓
- `npm run build` ✓: `/market` is static, the four `/api/market/*` handlers are dynamic, and `ensureStatic` holds.
- `npx playwright test`:
  - The first full run on the final code had 93 passed, 1 skipped and **8 failed**. All eight were 30 s timeouts in `/explore` and `/analyze` tests at 768 and 1440 px, which this slice doesn't touch.
  - `--last-failed` then passed all 8 (22.5 s), and a second full run gave 101 passed / 1 skipped ✓ (skip: mobile menu at 1440, by design). The timeouts look like machine load during the parallel run. Recorded here in case they come back.
  - After the last fix (the colour key position), `tests/e2e/market.spec.ts` was re-run: 18/18 ✓.
- Bundles: no fixture key (`lastMonth`, `yearly`) in `.next/static`. The `/market` HTML is 83 kB, holding the four default answers and their tables.

**Bugs found while testing (fixed):**
- The provenance note under every band read "generated by scripts/build-demo-fixtures.mjs with seed …". The fixture note is now reader-facing.
- SVG collapsed the space before "selected" in bar and dot labels. They now use `dx`.
- At 768 px each chosen Bezirk's colour key sat at the right edge of its grid cell, next to the following column's checkbox. It now follows the name.
- The first Playwright pass of the new spec had ambiguous locators (the type select vs. table regions, tooltip text vs. table cells). The tooltip got `data-chart-tooltip`.

**Design review (screenshots 375/768/1440, default and filtered):**
- One bold element per screen: the hatched demo notice at the top. Modules are plates with bands, not cards.
- The demo label appears in every band, inside every SVG, in every table caption and in the page notice. Nothing on the page states a market value outside a demo-labelled module, and the page title and description carry no values.
- Charts follow §8:
  - The trend uses slots in chosen order, with a legend for 2+ series and end labels from 480 px.
  - The district comparison uses one hue, with an outline and "selected" for chosen Bezirke.
  - Every chart has one y-axis, bars start at zero, and adjacent columns keep a 2 px gap.
- No horizontal scroll at 375, 768 or 1440 px. Below `lg`, long Bezirk names stack above their bars instead of clipping.
- Known: rare types (lofts, penthouses) give jagged demo lines with monthly gaps. That is the honest shape of sparse data, and the method note explains the gaps.

**Accessibility review (slice 5: filters, charts, tables, states):**
- axe (wcag2a/aa, 2.1, 2.2): 0 violations at 375, 768 and 1440 px, on the default view and on a filtered view with an empty state.
- Keyboard:
  - Every chart is one tab stop (`role="slider"`). Arrow keys, Home/End and the Page keys move the cursor, the readout is its `aria-valuetext`, and Esc dismisses the visual tooltip (1.4.13).
  - Checkboxes, selects and the reset button are native.
  - The refused 5th Bezirk stays in the tab order, with `aria-disabled` and a description.
- Live regions:
  - A status line for the refused Bezirk.
  - One polite summary when every module has settled after a change ("Charts show Mitte and Pankow, apartments, 2023 to 2025."), including how many charts failed.
  - Link-cleaning notices.
- Tables: a real `<table>` with a caption (scope plus provenance words) and row headers, in a focusable scroll region, available before JavaScript.
- Contrast:
  - The interquartile band was translucent series 1 at 1.6:1, and is now `seq-2` at 3.3:1 (1.4.11).
  - Bars and columns in series 1 are 5.1:1 on the sheet. Text uses text tokens only.
- Targets: each checkbox row is at least 36 px, with the whole label clickable. Selects are 44 px.
- 2.4.11: the filter rail scrolls inside a sticky column at `lg`, with focus rings unclipped (padding added).
- [!] Forced colors: the chart texture channel (§8.5) is not built. SVG fills keep their token colours. Planned for slice 9, with the "patterns" setting.
- [!] Screen-reader smoke test of Flow 4 **skipped**: NVDA and Firefox are still not installed.

## Slice 6 — Neighborhoods (depends on: 0, 2)
- [x] Directory `/neighborhoods` (D-045):
  - One A–Z table of all 97 Ortsteile, in the static HTML
  - Search, Bezirk and ring status in a `role="search"` rail, reusing `features/neighborhood-explorer/filters.ts`
  - URL state `bezirk`/`ring`/`q` (D-037 pattern), with cleaning of unusable links
  - Count in a polite live region; Enter on a single match opens its profile
  - Empty state that lists each active filter with its own Remove button, plus "Clear all filters"
- [x] Profiles `/neighborhoods/[slug]`, all 97 prerendered (D-043, D-044):
  - LocatorPlate, facts ledger (Bezirk, Ortsteil number, area, ring status and share with the method stated, borders), and a nearby table across Bezirk borders
  - Honest modules: market (the source's demo band, no figures, link to the Bezirk on the dashboard), transit (not connected), character (not written yet)
  - Analyze (prefilled `bezirk` + `ortsteil`) and Explore (`?o=`) links; meta from geometry facts only
- [x] Unknown slug: `notFound()` → HTTP 404 (also on a repeated request). The root 404 has a GET search box into the directory and the A–Z link. `dynamicParams = false` is unavailable with Cache Components (D-043).
- [x] Locator labels placed against collisions at two widths, and a caption that mentions the ring only when it is in view (D-046). This also applies to the homepage preview.
- [x] E2E Flow 2: `tests/e2e/neighborhoods.spec.ts`. It covers:
  - silhouette → directory → filters → profile → neighbour → map
  - filters surviving a profile visit and Back
  - the empty state and its way out
  - the unknown slug: 404 twice, plus the search box
  - axe and horizontal scroll on the directory and three profiles
  - all 97 profiles at 375 px: 200, h1 = name, no horizontal scroll
- [ ] `/methodology#ring`, the "How this is calculated" target on profiles, returns 404 until slice 8 (like `#market-data`).
- [ ] Pre-hydration: a filtered link shows all 97 rows until hydration applies the filters (as on `/explore`). Slice 9.
- [ ] On the unknown-slug 404 the `<title>` ("Page not found") arrives in the streamed metadata after hydration, not in the static `<head>`. The page is still answered with status 404.
- [ ] Profile HTML is about 95–105 kB each (locator paths plus the RSC payload). To be weighed in the slice 9 performance pass.

**Slice 6 checks (2026-10-29):**
- `npm run typecheck` ✓
- `npm run lint` ✓ (0 problems)
- `npx vitest run` 236/236 ✓ (21 files; new: `neighborhoods` (profiles, meta, label placement, ring-in-view, URL writer) and `neighborhood-directory`)
- `npm run fixtures:build -- --check` ✓. The demo note was reworded and regenerated (D-044).
- `npm run build` ✓: `/neighborhoods` static, 97 profiles fully static (`response: complete` in the prerender manifest), `ensureStatic` holds.
- Production server by hand: `/neighborhoods/not-a-place` 404 (cache MISS), then 404 again (HIT). `/neighborhoods/moabit` 200, title "Moabit, Ortsteil of Mitte".
- `npx playwright test`, three full runs on the final code:
  - **Run 1:** 115 passed / 3 skipped / **2 failed**. Both were the homepage A3 test (375, 1440), which raced `/analyze` removing its prefill query. Repeated 3× it failed 1 in 9. That test is from slice 2 and the race isn't caused by this slice. **Fixed the test**: it now checks the prefilled form instead of the transient URL, and passed 15/15 repeated.
  - **Run 2:** 115 passed / 3 skipped / **2 failed**. Both were 30 s timeouts (`/analyze` Flow 1 at 768, `/explore` map click at 1440), with the dev server still running alongside. `--last-failed` then passed both (18.7 s).
  - **Run 3:** 117 passed / 3 skipped ✓, after stopping the dev server. The skips are the mobile menu at 1440, by design, and the 97-profile walk, which runs only at 375.
  - **After the search-flush fix** (below) and a rebuild: 120 passed / 3 skipped ✓, including the new "typed just before leaving" test at all three widths.
- frontend-quality gate, re-run after the fix:
  - typecheck ✓ and lint ✓ (the gate caught a broken regex in the new E2E test first)
  - `npm run test` 236/236 ✓
  - build ✓
  - Boundaries: no server marker (geo build messages, `ortsteilCodes`, `AX_KommunalesGebiet`, `demo-market-v1`, `yearly`) in any client chunk. The only client component is the directory, and profiles ship no new client code.
- First-load JS (gzip, module scripts in the prerendered HTML, `noModule` polyfills left out), against the 150 kB budget (ARCH §10):

  | Route | JS (gzip) |
  |---|---|
  | `/neighborhoods` | 147.3 kB ✓ |
  | `/neighborhoods/moabit` | 140.3 kB ✓ |

  MapLibre is in neither route.
- [!] **First measurement of the older routes:** they are already over the 150 kB budget (`/` 177.8 kB, `/analyze` 202.9 kB, `/market` 195.6 kB, `/explore` 151.7 kB). The shared baseline (React, the Next runtime and the shell) is about 140 kB: a profile page, which adds no client code, measures 140.3 kB. This predates slice 6 and goes to the slice 9 performance pass.

**Bugs found while testing (fixed):**
- Köpenick's locator labels overlapped at 375 px, and long labels near the edge ran off the plate. They are now placed (D-046).
- The caption claimed a ring line on plates where none is in view, e.g. Blankenfelde.
- The demo band on profiles read "made to build and test this dashboard".
- The Remove buttons' hidden text lost its leading space ("Removethe …") in the accessible name. They use `aria-label` now, starting with the visible word (2.5.3).
- Areas in tables mixed one and two decimals ("7.7" over "10.58"). Tables use two fixed decimals.
- "S-Bahn" broke at its hyphen in the ring hint (directory and `/explore`).
- A search typed and left within 400 ms, by Enter on a single match or a click on a row, was lost on Back: the delayed URL write was cleared when the route hid. The pending write is now flushed before Enter navigates and on any click inside the directory. Component and E2E tests cover it.

**Design review (screenshots 375/768/1440: directory default, filtered and empty; profiles Moabit, Mitte, Köpenick, Blankenfelde, Hansaviertel, Alt-Hohenschönhausen, Märkisches Viertel):**
- One bold element per screen: the profile name in Archivo display, or the directory title. Modules are plates with bands. There is no card grid and no rating.
- Every data-bearing block carries words:
  - official on the facts, the nearby table and the locator
  - the demo hatch plus its label on the market module, which holds no figures
  - a dashed outline and "Not connected" on transit
  - a muted panel and "Not written yet" on character
- Long names hyphenate (`lang="de"`, `hyphens-auto`), e.g. "Alt- / Hohenschön- / hausen" at 375 px. No horizontal scroll on any of the 97 profiles at 375 px (E2E).
- From `lg`, the facts ledger sits beside the locator, so the header has no dead space. The layout departs from the DESIGN_DIRECTION wireframe here and orders verified sections first (D-044).
- Known: below `md` the filter rail fills most of the first screen before the table. It is kept open, as on `/market`, because the search field is the main tool. Revisit in slice 9.

**Accessibility review (slice 6: directory filters, table, empty state, profile, 404 form):**
- axe (wcag2a/aa, 2.1, 2.2): 0 violations at 375, 768 and 1440 px on the directory, the empty state, three profiles and the unknown-slug 404.
- Keyboard (scripted Tab walk at 1440 and 375 px, the first 16–22 stops): the order follows the page. The ring radios are one stop. Every walked stop shows the 2 px outline, and none was under the sticky header. Deeper table rows were not walked; the site-wide scroll padding (shell spec) covers them.
- Focus after actions: emptying a filter from the empty state moves focus to that control. "Clear filters" and "Clear all filters" move it to the search field.
- Live region: the count after each filter change, and after 800 ms when typing.
- Link-cleaning notice: `role="status"`.
- Tables: real `<table>` with a (visually hidden) caption, column headers and row headers. The current Ortsteil row says "(this Ortsteil)" in text, not by shading alone.
- Locator: `role="img"` with title and a description naming every neighbour. The HTML labels are `aria-hidden`. Names dropped for space are still in the borders list.
- 404 form: a labelled `type="search"` field in `role="search"`. It submits without JavaScript (GET to `/neighborhoods?q=`), but the directory applies `q` only once hydrated. Until then all 97 rows show (the pre-hydration item above).
- [!] Screen-reader smoke test **skipped**: NVDA and Firefox are still not installed.

## Slice 7 — Compare (depends on: 3)
- [x] Versioned storage + external store + cross-tab sync + corrupt-data handling (built in slice 3: `features/property-comparison/store.ts`, `tests/unit/compare-store.test.ts`). `replaceCompareItem` now reports an item that is gone instead of writing, and the store shares the dialog's rent and link rules.
- [x] Refactor first, as its own commit (`d688bae`): `PropertyFields` extracted from `/analyze`. Its server-rendered `<main>` is byte-identical before and after, and the analyze and home E2E specs passed unchanged (48/48).
- [x] `/compare` page (D-047, D-050):
  - Empty state ("Add a property", "Start from an analysis"); a neutral "reading" state until hydration, with a `<noscript>` note
  - One comparison table: row headers from `md`, label rows below it, `headers` on every value cell, sticky property names
  - "Missing" in text (F3); a missing asking rent offers "Add the asking rent", which opens the editor on that field
  - €/m² from the user's own rent and area only, labelled "from your entries"; predicted rent always "Model not connected", one cell across all columns; no ranking
  - Listing links by host, new tab, `rel="noreferrer"`, "(new tab)" in the text
  - Notices for dropped (corrupt or old-version) data, with Dismiss, and for blocked storage
- [x] Add / edit / replace dialog (D-048): the `/analyze` field set plus name, asking cold rent (German and English number formats) and link (http/https only). A fourth property must replace one. "Fill in from your analysis" from the tab's draft (3.3.7). Closing an add keeps its entries until the user leaves the page. Edits of a property removed in another tab are kept and saved as a new one. Loaded on demand (`next/dynamic`), fetched after hydration.
- [x] Remove and Clear all ask first; focus and a polite announcement follow every change (D-050).
- [x] `Dialog` is StrictMode-safe when mounted open (D-049).
- [x] E2E Flow 5: `tests/e2e/compare.spec.ts`. It covers:
  - from `/analyze` with the rent flagged, adding the rent, €/m², a reload
  - two adds by hand, a fourth that must replace one, remove (with Keep it first) and clear, with focus checked after each
  - `javascript:`, `ftp:` and scheme-less links rejected; rents that aren't amounts; `1,150.50` saved as 1150.5
  - the add dialog closed and reopened with its entries; "Fill in from your analysis"
  - corrupt JSON, an old version and an invalid item: dropped, with the notice
  - axe empty, full and with the dialog's error summary; three properties at an explicit 360 px with no horizontal scroll
- [x] `/methodology#your-data` (the "From your entries" band link) and `#in-development` returned 404 until slice 8. Both resolve now (slice 8).
- [ ] Before hydration the page shows the "reading" state, so a saved comparison is never in the static HTML (it can't be: it lives in the browser).
- [ ] At 375 px a long property name is clamped to three lines in the sticky header; the full name is in the accessible name and the edit dialog.
- [ ] At 320 px (400 % zoom) words longer than a column (about 69 px) break without a hyphen: "Unfurnished", a long host, a long user-typed name. Nothing is cut off and nothing scrolls sideways; from 360 px the fixed values fit.

**Slice 7 checks (2026-10-29):**
- `npm run typecheck` ✓
- `npm run lint` ✓ (0 problems). One React Compiler finding during the refactor: it inferred `setNotice` as a dependency of `/analyze`'s `onSearch`; the stable setter is now listed.
- `npx vitest run` 287/287 ✓ (24 files). New: `compare-validation` (euro parsing, listing fields, every accepted value also accepted by the stored comparison), `compare-rows` (row values, €/m², labels, hosts), `compare-view` (9 component tests), and a store test for replacing a removed item.
- `npm run build` ✓: `/compare` static.
- `npx playwright test`, four full runs on the final code or close to it:
  - **Run 1:** 135 passed / 3 skipped / **3 failed**, all 30 s timeouts at 1440 (compare Flow 5, compare axe, `/explore` map click). `--last-failed` passed all three (9–10 s each). The two compare tests now have 60 s: about 10 s alone, with four adds or three axe scans.
  - **Run 2:** 127 passed / 3 skipped / **11 failed**: 10 timeouts and one URL mismatch, all at 375, across analyze, explore, neighborhoods and compare. `--last-failed` passed all 11 (24.2 s).
  - **Run 3:** 137 passed / 3 skipped / **1 failed**: the slice 6 test "a search typed just before leaving" got `q=oa`. It typed before the directory had hydrated and the first key was dropped. The directory now sets `data-hydrated` and the test waits for it.
  - **Run 4:** 138 passed / 3 skipped ✓, after a rebuild. The skips are the mobile menu at 1440, by design, and the 97-profile walk, which runs only at 375.
- frontend-quality gate:
  - Boundaries: no server marker in any client chunk. The compare page gets Bezirk and Ortsteil options as props; it imports no geo data module. No fixture import, no third-party fetch.
  - Provenance: the table sits in a Plate with `user` provenance ("From your entries"). The only money figures are the user's own asking rents and €/m² worked out from them, which DATA_BOUNDARIES §1 allows "as the user's own claim". No model number, no formula beyond rent ÷ area.
- First-load JS (gzip, module scripts, `noModule` left out): `/compare` **183.5 kB**, over the 150 kB budget (201.7 kB before the dialog was split out). The rest is the shared ~140 kB baseline plus Zod for validating stored data on read (PRD F4). For slice 9: Zod Mini for the store would be the next cut.
- After the review fixes below (second slice 7 commit): `npm run typecheck` ✓, `npm run lint` ✓, `npx vitest run` 287/287 ✓, `npm run build` ✓, `npx playwright test tests/e2e/compare.spec.ts` 18/18 ✓ against that build. The full E2E suite was not rerun for these fixes: they touch only `CompareTable` classes and the clear dialog's wording.

**Bugs found while testing (fixed):**
- The add dialog closed as soon as it opened in development: StrictMode's extra effect run reached `Dialog`'s unmount cleanup, which called `onClose` (D-049).
- The dialog had two buttons named "Close" (the header's ✕ and the footer). The footer now says "Close and keep my entries".
- Reading the `/analyze` draft from the dialog would have removed a broken draft before `/analyze` could say so. The dialog uses `peekDraft`, which never removes.
- A seeded E2E comparison was consumed by the page's first read when written before hydration; the tests wait for `#compare-view[data-hydrated]` (`/analyze` stays mounted with its own marker, so the bare attribute matched twice).
- Found on the screenshots after the first commit:
  - The listing link had `break-all`, so at 768 px it read "example.org (new ta b)". "(new tab)" is now kept whole, and only a host too long for its column breaks.
  - From `md`, the empty corner cell over the row headers didn't stick with the names, so row headers ("Listing", "Energy class") scrolled into view beside the sticky names. It now sticks with them.
  - On phones the expanded names broke inside words ("Turmst raße", "Weddin g" at 320 px; "Turmstraße" is 103 px wide expanded, the column 69–88 px). Below `md` the names now use the condensed width that DESIGN_SYSTEM §3 gives table headers, and the expanded width from `md`.
  - "Clear all" with one property said "All 1 property is deleted…". It now says "This property is deleted…".

**Design review.** These screenshots were opened and looked at:
- Empty state at 375 and 1440.
- Three properties: 1:1 slices of the table at 320 and 375, and full pages at 768 and 1440.
- The sticky names mid-scroll at 768 and 1440, with 3× crops at five scroll positions at 1440.
- The add dialog at 320; the dialog's error summary with the replace choice at 768.
- Forced colors at 1440: the table and the dialog.

Findings:
- One bold element: the property names over the table. The page is a plate with the "From your entries" band, a legend rail and a caption. No cards, no ranking, no colour used for "better".
- Rows align on the first baseline across columns. Rule weights group the rows: place and size, the rent block, details, note and link.
- German place names hyphenate (`lang="de"`): "Gesundbrun-nen", "Charlotten-burg". English values and user-typed names don't. The Chromium used here hyphenates German but not English: a probe at 60 px gave "Unfurnished" an emergency break, not a hyphen. Other browsers weren't checked. At 375 every fixed value fits; at 320 the long ones break mid-word (open item above).
- Forced colors: rules, the not-connected mark and the dialog border stay visible.
- Departure from the wireframe: no empty "Add" column (D-047).
- Not this slice's: the site header is `bg-paper/95` (slice 1), so rows scrolling under it show through faintly. Listed for the slice 9 screenshot pass.

**Accessibility review (slice 7: table, dialog, confirm dialogs, notices):**
- axe (wcag2a/aa, 2.1, 2.2): 0 violations at 375, 768 and 1440 px: empty, three properties, and the open dialog with its error summary.
- Keyboard (scripted Tab walk at 1440 and 375 px with three properties: 28 and 23 stops, rerun after the review fixes): every stop has the 2 px outline. None is under the site header or the sticky names. The script flags "Skip to content" as covered: it is drawn over the header when focused, so that is a false positive.
- [x] **Focus order differs from the visual order at `lg`.** Fixed in slice 9 (D-053). WCAG 2.4.3 Focus Order and 1.3.2 Meaningful Sequence. Severity **low**. Deferred to slice 9.
  - From `lg` the legend rail is drawn left of the table, but it comes after the table in the DOM, so its one link is reached after the table's controls.
  - On phones and at `md` the rail is drawn below the table, so the order matches there.
  - Low because the rail is a legend for the table, and its link ("What this means") duplicates the one in the predicted-rent row.
  - Fix in slice 9 together with the other routes' rails: put the rail first in the DOM, or keep it after the table at every width.
- 320 px (1.4.10 Reflow): no horizontal scroll and nothing cut off with three properties. Words break mid-word there (see the open item above).
- Dialogs: Esc closes and focus returns to the opener. After a save, remove or clear, focus goes where D-050 says, checked in component and E2E tests. Back and Forward with the add dialog open (Activity): no dialog left open on either page, and the entries are offered on the next add (checked by script).
- Errors: the dialog's summary takes focus and links to each field, including the replace choice. Messages name the fix.
- Table: real `<table>` with a hidden caption, column headers, row headers from `md` and explicit `headers` below it. The link says "(new tab)" in text.
- Announcements: add, replace, edit, remove and clear, in the page's polite region, after the dialog closes. The dialog has its own region for the Bezirk/Ortsteil sync.
- [!] Screen-reader smoke test **skipped**: NVDA and Firefox are still not installed. The two table arrangements rely on `headers`, so this is the first thing to check with a real reader.

## Slice 8 — Methodology (depends on: 0, 3, 5)
- [x] Sections mirroring the PRD §3 truth table (D-052). The page opens on "On this page", then the capability table (one row per PRD §3 row, each linking to its section), then one section per row in the same order, then known limitations and the registry. PRD G1 topics:
  - what works today: `#what-works`
  - geodata derivations: `#geodata`, with `#areas`, `#ring`, `#adjacency` and `#drawing`
  - market data vs. predictions: `#market-data`, `#market-vs-predictions`
  - in development: `#in-development`, with `#predictions`, `#uncertainty` and `#transit`
  - your entries, neighborhood descriptions and known limitations: `#your-data`, `#neighborhood-content`, `#limitations`
  - data sources and licenses: `#sources`
- [x] Dataset registry (D-051): `lib/data/registry.ts`, checked against `data/PROVENANCE.md` in both directions. Checksums and the download date come from the geodata build output.
- [x] Ring, area and adjacency method. The thresholds, counts, the Moabit key example and Blankenfelde's computed area all come from the geodata. The thresholds are checked against the build at load.
- [x] Uncertainty explainer: why a single rent can't be named, and that a range or "No uncertainty range available" will accompany an estimate. The method and level are named as open questions for the model team.
- [x] All provenance band links resolve to anchors: `tests/unit/methodology.test.ts` scans `src/` for `/methodology#…` (7 distinct ids today, all present). The E2E follows links from `/`, the footer and `/market`.
- [x] Follow-up for slice 9 (done): four E2E specs still ignore console 404s "from routes built in later slices". Every route exists now, so the filter can go.

**Slice 8 checks (2026-10-29):**
- `npm run typecheck` ✓, `npm run lint` ✓ (0 problems).
- `npx vitest run` 295/295 ✓ (25 files). New: `methodology.test.ts`, with 8 tests: anchors, the registry against `PROVENANCE.md` and the build, and the raw area field quoted in the copy.
- `npm run build` ✓: `/methodology` static (○).
- `npx playwright test tests/e2e/methodology.spec.ts --workers=2`: 15/15 ✓, on the build before the last copy and markup fixes (license id, service-address wrapping, the Kaggle mark, apostrophes, "as downloaded"). Its first run failed 15/15 because an old `next start` from slice 7 was still serving port 3100 without the new route. That server was stopped and the run repeated.
- Full suite on the final build, `npx playwright test --workers=3`: 156 tests. **119 passed, 1 skipped, 36 failed.**
  - All 36 failures are in `desktop-1440`. None is an assertion: 33 are "worker process exited unexpectedly (code=3221225794)", a process Windows couldn't start, and 3 are "Target crashed".
  - The machine had 0.5–1.7 GB of free memory. Claude Code then stopped the run for low memory.
  - `mobile-375` and `tablet-768` passed completely, including `methodology.spec.ts`. That build had everything but the "sent anywhere" sentence (bug list below), a copy-only change made afterwards and built (`npm run build` ✓, typecheck and lint ✓).
  - Rerun after memory was freed, on the final build, `npx playwright test --project=desktop-1440 --workers=1`: **50 passed, 2 skipped** (1.7 min). The two skips are by design: the mobile menu test (no menu button at 1440) and the 97-profile walk (phone only). `desktop-1440` is verified.
  - `methodology.spec.ts` rerun on the final build for `mobile-375` and `tablet-768`, `--workers=1`: 10/10 ✓.
- frontend-quality gate:
  - Boundaries: the page is a server component with no client component of its own. It reads `lib/data/geo` and `lib/data/registry` on the server and imports no fixture.
  - Provenance: the geography section carries the official label. The registry marks each dataset (official, not available, demo).
  - No euro amount appears on the page (an E2E check), and no demo value or Berlin market figure is quoted.
- First-load JS: `/methodology` 140.3 kB, the shared baseline, within the 150 kB budget. No server marker in any client chunk (re-measured for all routes; the others are unchanged).

**Bugs found while testing (fixed):**
- At 320 px the license id broke at its hyphen ("dl-/de/zero-2.0") and service addresses broke inside words. The id is kept whole, and the addresses wrap after their slashes.
- The Kaggle entry used the research mark in the registry, a solid rule that looks like "From your entries", while the table showed "Not available" with the dashed mark. Both use the dashed mark now.
- "The boundaries are as published on 29 October 2026" was wrong: that is the download date. It now says "as downloaded on".
- "Nothing you enter is sent anywhere" overstated it. The home page's short form opens `/analyze` with Bezirk, area and rooms in the address, which reaches the site's server. The sentence now covers Analyze and Compare and names that exception.

**Design review.** These screenshots were opened and looked at:
- At 1440: the top of the page; the geography section; the registry with the contents stuck beside it.
- At 375: the top with the contents; the capability table; geography; market figures.
- At 768: in development; known limitations.
- At 320: the registry before and after the license and address fixes; the capability table after them. On the final build: the whole registry (dashed Kaggle mark, curly apostrophes) and the research section. Measured: every checksum and address ends inside its row, and the page has no horizontal overflow. In a full-element screenshot the translucent header shows over the research section; that is the screenshot stitching, and in the viewport the section opens below the header.

Findings:
- One bold element, the page title. Prose runs in one measured column in Source Serif. Headings and tables are in Archivo. No cards; the registry is a ledger, one definition list per dataset.
- The contents list is 486 px tall, so it fits a 900 px window while stuck.
- No horizontal scroll at 320, 375, 768 or 1440. No console errors on the page.

**Accessibility review (slice 8: contents list, capability table, registry):**
- axe (wcag2a/aa, 2.1, 2.2): 0 violations at 375, 768 and 1440 on the final build.
- Structure:
  - One h1. Sections are `<section aria-labelledby>`, h2 with h3 inside.
  - The contents list is `<nav aria-labelledby>` ("On this page") and comes first in the DOM at every width, so the focus order matches the drawing.
  - The capability table has a caption, column headers and row headers.
- Links: each contents entry lands on its heading, below the sticky header (E2E: the heading is in the viewport and its top is under the header). The same holds for links from other pages. Each id is unique after other routes have been visited and kept mounted.
- [x] Keyboard (scripted Tab walk at 1440 on the final build, 45 stops up to the footer): skip link, header, the 17 contents entries, the 7 table rows, then the article and registry links, then the footer. Every stop shows the 2 px outline and none is under the sticky header. The script flags "Skip to content" as under the header; it is fixed at z-index 50 and is the topmost element at its centre when focused, so that is a false positive. Enter on a contents entry moves to its section (`#sources`, top 160 px, header bottom 65 px).
- [!] Screen-reader smoke test **skipped**: NVDA and Firefox are still not installed.

## Slice 9 — Responsive polish and QA (depends on: all)
- [x] Screenshot review at 375/768/1440 for every route and key state; fix list (below)
- [x] Full keyboard pass: scripted Tab walk on all nine routes at 1440 and 375 px. [!] Screen-reader pass **skipped**: NVDA and Firefox are not installed, and no VoiceOver device is available.
- [x] Dark mode: not shipped, `color-scheme: light` stays (D-055)
- [x] Optional demo choropleth on `/explore` (PRD C6): not built (D-056)
- [x] Chart texture channel for forced colors, print and the "patterns" setting (D-054)
- [!] Performance budgets checked: **first-load JS is over budget on five routes, and the budget can't be met as written.** Needs the owner's decision (below).
- [x] Final QA report (below)
- [x] Slice 7 and 8 follow-ups: the compare rail order (D-053), the opaque header, and the 404 console filters removed from four specs.

**Slice 9 fixes:**
- **Forced colors, charts** (WCAG 1.4.3, 1.4.11; severity high). Chromium leaves SVG paint alone under forced colors (other browsers not checked), so the Bezirk labels stayed dark ink on the system's black Canvas, close to invisible, and the lines kept their token colours. Charts now paint in system colors, with dashes and hatching (D-054). Checked by an E2E test and by screenshots.
- **Chart focus outline** (WCAG 2.4.7; high). The four chart sliders showed no outline when reached by Tab. In Tailwind 4, `outline-none` also sets the outline style variable to none, so `focus-visible:outline-2` drew nothing. The base `:focus-visible` rule now applies. An E2E assertion was added.
- **Dialogs in Safari** (WCAG 2.4.3; medium). A click in WebKit focuses the nearest focusable ancestor (`<main tabindex=-1>`), not the button, so a closed dialog returned focus to `<main>`. The dialog now records the pressed control and returns focus to it.
- **`/analyze` progress strip in WebKit** (WCAG 2.4.11; medium). WebKit ignores `scroll-margin` when focus moves, so a field could land under the sticky strip. The form scrolls it clear.
- **`/compare` legend** (D-053): first in the DOM, and below `lg` a closed "Legend and sources" disclosure above the table.
- **Header** is opaque; rows no longer show through it.
- **Footer**: "dl-de/zero-2.0" broke at its hyphen at 768 px; it is kept whole.
- **404 page**: the "404" eyebrow label above the heading is removed (no eyebrows, DESIGN_SYSTEM §3.2).
- **Patterns setting** on `/market`: "Draw patterns in the charts", saved in this browser (D-054).

**Slice 9 checks (2026-10-29):**
- `npm run typecheck` ✓, `npm run lint` ✓, `npx vitest run` 299/299 ✓ (26 files; new `chart-patterns.test.tsx`, 4 tests), `npm run build` ✓.
- E2E on the final build, one project at a time, `--workers=1`:
  - `mobile-375`: 54/54 ✓.
  - `tablet-768`: 53 passed, 1 skipped (the 97-profile walk, phone only) ✓.
  - `desktop-1440`: 52 passed, 2 skipped (the mobile menu; the profile walk) ✓.
  - `webkit-375` (new, opt-in with `QA_WEBKIT=1`): 44 passed, 2 skipped, 8 failed. All 8 were timeouts waiting for hydration or a navigation. With `--last-failed`, 7 passed; the eighth (`methodology.spec.ts` "its ids stay unique…") failed 1 of 3 with `--repeat-each=3`. The first footer click from `/` sometimes doesn't navigate within the 5 s limit. A scratch loop (10 fresh pages, click at once, 20 s ceiling) navigated every time, in 0.7–11.4 s: **slow navigation under load, not a lost click.**
  - The skip-link test is skipped in WebKit: links aren't Tab stops there unless "Press Tab to highlight each item" is on (Safari's default), and Playwright's WebKit has no Option+Tab on Windows.
- Tab walk (scripted, every route at 1440 and 375, up to the footer): every stop shows the 2 px outline and none is under the header or the strip, after the chart fix. Before it, the chart sliders were the only failure.
- Screenshot sweep: 15 states × 3 widths, full page, plus close-ups:
  - The states: home; analyze empty, with errors, and with a link-prefilled form; explore, and explore with Moabit selected; market with four Bezirke, and market empty; directory, and directory with no match; a profile; compare empty, and compare with three properties; methodology; 404.
  - Automatic checks: no horizontal overflow anywhere. The flags were false positives: the explore list title is `sr-only` below `lg`, and the market tables scroll inside their own focusable region. The 404 page's console error is its own 404.
- Forced colors and print at 1440 on `/market`, and the patterns setting: screenshots of all four charts.

**Performance (the owner chose to restate the budget, D-057; every route is now within it):**
- First-load JS (gzip, measured from the final build): `/` 177.9 kB, `/analyze` 204.1, `/market` 196.0, `/compare` 183.9, `/explore` 151.7, `/neighborhoods` 147.4, profiles and `/methodology` 140.3. The budget is 150 kB. No server marker in any client chunk, and MapLibre is in no first-load chunk.
- The shared baseline (React, the Next runtime, the shell) is 140.3 kB. Every route therefore has about 10 kB for its own code, so the budget can't be met as written.
- The largest avoidable piece is classic Zod: one 30 kB chunk on `/`, `/analyze`, `/market` and `/compare` (it includes JSON Schema, email, JWT and other validators the app doesn't use). A bundle test of the same schema shapes measured 23.7 kB for classic Zod against 6.9 kB for `zod/mini`. Moving client-side validation to `zod/mini` would save roughly 17 kB per route. That is a rewrite of about 850 lines of schemas, and four routes would still be over 150 kB.
- Lighthouse 12.8.2, mobile preset (simulated 4× CPU slowdown), local production server, about 1 GB of free memory:
  - Simulated: `/` LCP 8.0 s, TBT 1,780 ms, score 0.41. `/analyze` LCP 6.6 s, TBT 730 ms. `/methodology`, which ships no code of its own, LCP 6.3 s, TBT 1,080 ms.
  - Unthrottled (`--throttling-method=provided`): `/` and `/methodology` both LCP 1.4 s, TBT 0 ms.
  - Even the baseline-only page is far from 2.5 s under simulation. The loaded machine dominates these numbers, so they neither confirm nor refute the LCP budget. The relative signal: `/` adds about 700 ms of blocking time over the baseline page.
  - LCP is text (the home h1, a prose paragraph elsewhere). On `/` 94 % of it is render delay; the cause isn't established, since `/methodology` shows the same pattern without route code.
- Options for the owner: (a) restate the budget as baseline plus a route allowance; (b) move client validation to `zod/mini`; (c) both. Re-measure on an idle machine either way.

**Known gaps, decided:**
- Before hydration a filtered `/neighborhoods` or `/explore` link shows all 97 rows (slice 6). Accepted: the filters live in the URL and are applied on hydration. The static page stays one file per route (D-027).
- Profile HTML is about 95–105 kB each (slice 6; Moabit 96 kB). Accepted for this phase: most of it is the locator SVG and its RSC copy. Not measured further.
- At 320 px, words longer than a compare column break mid-word (slice 7). Accepted: nothing is cut off and nothing scrolls sideways, and from 360 px the fixed values fit.
- After a client navigation the page `<title>` arrives with the streamed metadata, after the page. In WebKit it was empty at hydration and set within 1.5 s in a manual run; under the test runner it took more than 5 s (the Flow 1 test now waits up to 15 s before axe). Same cause as the slice 6 404 title. Not fixed.

**Design review (slice 9):** looked at the full-page sweep at 375, 768 and 1440 and the close-ups (compare, market rail, home, explore, analyze, profile, directory, 404, footer). One bold element per screen holds on those. The new disclosure on `/compare` uses the existing `Disclosure` (a chevron, an underlined summary). The patterns checkbox sits under the filters with a rule above it, in the rail's type sizes.

**Accessibility review (slice 9):** the findings above, with their criteria. axe passes on every route at all three widths and in WebKit, except where WebKit timed out (above). [!] Screen-reader smoke test **skipped** again: no NVDA, Firefox or VoiceOver here. The `/compare` table's `headers` arrangement is still the first thing to check with a real reader.

## Blocked / external
- [!] Real market data: waiting for the Kaggle files + URL/license (PRD Q1)
- [!] Contract v1 freeze: waiting for the ML feature schema (PRD Q2/Q3)

## Slice 10 — Demo model service (ML phase; depends on: 3; owner approved 2026-10-30, D-058)
- [x] Colab work: five CSVs profiled, intake finished (`demo-only`, synthetic by the author's description), leakage screen, chronological split, linear/CatBoost/MLP comparison, conformal interval, artifacts. The notebook is the owner's; the artifacts are small (linear model, schema, metadata, `inference.py`).
- [x] Docs: `data/PROVENANCE.md`, DATA_BOUNDARIES (§1, §2, §4), VISION (§3.1), PREDICTION_API draft.2, CLAUDE.md integrity rule, D-058
- [x] Artifact transfer: the browser download of the zip failed, so the small files (`linear_model.json`, `residual_quantiles.json`, `feature_schema.json`, `metadata.json`, `experiments.csv`) were moved as text and checked by SHA-256 against Colab. The CatBoost challenger (1.7 MB) and the notebook are not in the repository.
- [x] `services/rent-api/`: FastAPI service (health, `POST /api/v1/predictions/rent`, model card, schema), error envelope for every non-2xx, pinned requirements, README. The model is the log-linear regression evaluated with NumPy from JSON (no pickle, no scikit-learn at run time; max difference to the notebook pipeline 1.3e-15 on 30,000 rows).
  - Checks: `pytest -q` in `services/rent-api` with scikit-learn and joblib uninstalled: 27 passed (golden values, contract fixture, 422 cases, 404, 503). Real `uvicorn` run on port 8000: health ok; the repo request fixture answered 200 with `synthetic: true`, `TRAINING_DATA_UNVERIFIED`, `X-Request-ID` echoed; `{"bezirk":"Mitte"}` answered 422 in the error envelope; server stopped afterwards.
  - Python 3.12 is at `%LOCALAPPDATA%\Programs\Python\Python312` (not on PATH).
- [x] Frontend (2026-10-30): `synthetic`, `inputs.ignored` and `explanation` in the response schema; `Provenance` `model` carries `trainedOn`; `interpret` returns `ok` (`trainedOn: "synthetic"`) only for `synthetic: true`, and `not_connected` / `unverified_data` for a missing flag or `false` (D-058); ResultPanel draws a synthetic answer under the hatched band, "Demo model" and the fixed words, with the ignored fields and a "What moved the estimate" disclosure; contract fixtures `ok-observed` and `ok-no-flag` added, `ok` and `ok-no-interval` carry the flag.
  - Checks: `npm run typecheck` ✓, `npm run lint` ✓, `npx vitest run` 310/310 ✓ (26 files), `npm run build` ✓. E2E on the default build, one project at a time, `--workers=1`: `mobile-375` 54/54, `tablet-768` 53 + 1 skipped, `desktop-1440` 52 + 2 skipped (the same skips as slice 9).
  - **Live E2E against the real service** (`playwright.live.config.ts`, `tests/live/analyze-live.spec.ts`): `uvicorn` on 8000 and a proxy-mode build (`NEXT_DIST_DIR=.next-live NEXT_PUBLIC_PREDICTION_MODE=proxy npm run build`) on 3101. 6/6 passed (2 tests at 375, 768 and 1440 px): the form answers with a figure under the demo band and the fixed words, "Sent, but this model does not use them: Property type.", the interval is ordered around the point estimate, no € in the title or meta text, no horizontal scroll, axe clean; a flat with most fields open also gets an answer. Screenshots of the result panel at 1440 and 375 px reviewed.
  - First-load JS: the budget was re-estimated, not re-measured by the slice 9 method (a scratch gzip sum of the scripts in the built HTML reads about 43 kB above the recorded figures on `/methodology`). Relative to that offset `/analyze` grew by about 3 kB, to about 207 kB, under its 210 kB allowance (D-057). Re-measure on an idle machine before relying on it.
  - Review fix (advisor): the first version showed `synthetic: false` as an unlabelled "Model estimate". D-058 says a client that can't see `synthetic: true` treats the answer as `not_connected`, so `false` now does too; the panel can still draw `observed` (tested by hand-built outcome), the interpreter never returns it.
  - **Design review** (`design-system` skill, screenshots 1440 and 375): one bold element holds (the figure); the hatched band, "Demo model" and the fixed words sit above the number. No arrows, no eyebrows, no all-caps, role tokens only, the disclosure is the existing `Disclosure`. The factor list is a plain two-column ledger. The `unverified_data` copy and the "observed" frame were not screenshotted (component-tested only). Not checked at 768 px by eye (live test asserts no horizontal scroll and axe there).
  - **Accessibility review** (`accessibility-review` skill): axe 0 violations on the result at 375, 768 and 1440 px; the result heading takes focus (asserted); the new disclosure is a native `<details>`, so keyboard and name come with it; the hatched band is `aria-hidden` and the demo words are text. [!] Screen-reader smoke test **skipped** again: no NVDA, Firefox or VoiceOver here. Forced colors and reduced motion not re-run for the new panel (it adds no motion and uses existing border and hatch utilities, but that is unchecked).
- [x] `/methodology` (2026-10-30): the Kaggle section now says the dataset is synthetic and demo only; the rent model section says it is a demo and how it appears; new subsection "What was compared" (split, the four validation errors, the tie and its interval, why the linear model is served, the 2026 bias, LightGBM not tried); the uncertainty section gives the split-conformal method and the measured coverage (78.9 % and 76.4 %); capability table, dataset registry, "Your entries" and limitations match. The registry test now reads the licence per entry. The capability row and the registry entry are named "Kaggle dataset (5 CSV files)" (no longer "research dataset").
- [x] Presentation (2026-10-30): README rewritten (it still said "specification phase"), six screenshots in `docs/screenshots/` (home, explore, market, profile, methodology, the demo answer), `services/rent-api/MODEL_CARD.md` written for the Hugging Face Hub. Nothing was uploaded or deployed. The model card names the Kaggle dataset and keeps the synthetic label (the dataset's author describes the listings as generated). The owner chose MIT for the repository (`LICENSE`, holder `cyberx801`; the model card front matter says `license: mit`). The word "portfolio" was removed from the README and the model card. The model card was rewritten in plain language and uploaded with the five artifact files to the Hugging Face repo `mfozdil/berlin-rent-demo` (the six files' blob SHAs matched the local ones). On the owner's request it was then made **public** (2026-10-30), with a "How to use it" section in the card and `inference.py` added beside the artifacts. Checked as a stranger: no token, `snapshot_download` of the 8 files, then `RentModel(path).predict(...)` returned 200, 1265 EUR with a 924 to 1643 range and `synthetic: True`. The README links the repo. The Hub connection from this machine resets at random, so each call is retried. The access token the owner pasted into the chat should be revoked. The site went live on Netlify the same day (D-060). Live check in a browser: all 8 routes answer 200 and the 404 page answers 404, no console error except one on every page: React #418 from the comment Netlify injects (fixed by the head script, D-060: the first version missed because the line break sits before the comment; after the corrected redeploy all 8 routes hydrate without error on the live site). `/market` shows the demo band, and `/analyze` ends at "Prediction engine not connected" with no prediction request sent.
- [x] First page and embedded model (2026-10-30, owner asked after finding Analyze a dead end on the live site; D-061).
  - Home: plain statement of what the site is ("A study project...") and a "Pages" menu listing all six pages with one line each (`nav` "Pages on this site", E2E in `home.spec.ts` at three widths, axe clean). The lower section is now "What backs each page".
  - `src/lib/model/rent-model.ts`: TypeScript port of the Python inference; `embedded` mode in `config.ts` and the proxy route; `rentModelConnected` switches the static copy (home, footer, Analyze, Methodology, truth tables) from "not connected" to "Demo model, synthetic data". `netlify.toml` sets `NEXT_PUBLIC_PREDICTION_MODE=embedded` (build-time, because Netlify's toml variables are not available at run time).
  - Checks: `npm run check` ✓ (typecheck, lint 0 warnings, vitest 344/344 incl. 21 new for the port against 16 Python-service answers, build). Default E2E 165 passed, 3 skipped. Live E2E on an `embedded` build (`.next-live`, no Python service): 9/9 at 375, 768 and 1440 incl. axe on the result and a new test that the pages say "demo", not "not connected". Differences from Python where inputs are missing are in D-061.
  - Not yet checked: the deployed site (Netlify builds on push; verify live after it finishes).
- [ ] Not done and not planned: LightGBM benchmark, SHAP for the challenger, a sales or new-construction model in the product
