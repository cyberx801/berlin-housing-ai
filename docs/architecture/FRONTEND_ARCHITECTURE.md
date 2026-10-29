# Frontend Architecture

Status: v0.1 · 2026-10-29 · Decisions are referenced as D-### ([DECISIONS.md](../implementation/DECISIONS.md)).

## 1. Stack

Versions are the npm `latest` as of 2026-10-29 unless noted. They are pinned exactly in `package.json` at scaffold time, and the compatibility checks are recorded in DECISIONS.

| Concern | Choice | Version seen | Why |
|---|---|---|---|
| Framework | Next.js, App Router | 16.4.3 | SSG for 97 profile pages, route handlers for the future prediction proxy, `next/font` self-hosting |
| UI runtime | React / React DOM | 19.3.1 | Required by Next 16 |
| Language | TypeScript, `strict` plus `noUncheckedIndexedAccess` (`exactOptionalPropertyTypes` off, D-028) | **5.9.3** (not 7.0.2) | TS 7 is the native port, and Next's build-time type check and typescript-eslint depend on the JS API. Verified at scaffold (D-024). |
| Styling | Tailwind CSS v4 + CSS custom properties | 4.3.3 | Tokens live in CSS (`@theme`). There is no config-file sprawl. |
| Validation | Zod | 4.6.7 | One schema source for forms, URL parsing, storage and the API contract |
| Forms | React Hook Form + `@hookform/resolvers` | 7.91.0 / 6.0.2 (peer: zod ^4 ✓) | Uncontrolled performance on a 15-field form, and works with native inputs |
| Accessible primitives | Native HTML only: `<select>`, radio groups, `<details>`, `<dialog>` | — | Native controls win on mobile and with assistive tech. `showModal()` gives focus containment, inertness and Esc. No combobox is needed (D-026). |
| Charts | d3-scale / d3-shape / d3-array + our own SVG components | 4.0.2 / 3.2.0 / 3.2.4 | Full control of marks, tokens, tooltips, keyboard and table views with fewer dependencies (D-025, supersedes D-005) |
| Geo (SVG) | d3-geo + topojson-client | d3-geo 3.1.1 | Server-rendered SVG plates with no WebGL |
| Map | MapLibre GL JS | 6.16.0 | Open source. No key with our own GeoJSON. `/explore` only, dynamic import (D-004). |
| Geo build | mapshaper (devDependency) | 0.7.100 | Topology-preserving simplification, clipping, and area (D-010, D-011) |
| Icons | lucide-react | 1.63.0 | Utility glyphs only |
| Unit/component tests | Vitest + Testing Library + user-event + jsdom | 5.0.5 / 16.3.3 | Fast, ESM-native |
| E2E / a11y / visual | Playwright + @axe-core/playwright | 1.64.1 / 4.14.0 | Journeys, axe scans and viewport screenshots |
| Lint | ESLint flat config + `eslint-config-next` (bundles typescript-eslint) | 9.39.5 / 16.4.3 | `next lint` is gone in 16.x; the `eslint` CLI is used (D-024). |

Not used:
- a global state library (D-018)
- a motion library (D-013)
- a CSS-in-JS runtime
- a UI kit (shadcn or similar), since its defaults are the generic look we are avoiding
- analytics

## 2. Repository layout

```
berlin-housing-ai/
├─ .claude/skills/{design-system,frontend-quality,accessibility-review}/SKILL.md
├─ data/
│  ├─ PROVENANCE.md                 dataset registry (human-readable)
│  ├─ raw/geo/*.geojson             official downloads, checksummed, committed
│  └─ raw/kaggle/                   intake folder (gitignored until license verified)
├─ docs/{product,design,architecture,contracts,implementation}/
├─ public/geo/                      GENERATED simplified GeoJSON for MapLibre (lazy fetch)
├─ scripts/
│  ├─ build-geo.mjs                 raw → derived (mapshaper), with asserts
│  └─ build-demo-fixtures.mjs       seeded, deterministic demo market fixtures
├─ src/
│  ├─ app/                          routes only: compose features, load server data
│  │  ├─ layout.tsx  page.tsx  not-found.tsx  error.tsx  global-error.tsx
│  │  ├─ analyze/  explore/  market/  compare/  methodology/
│  │  ├─ neighborhoods/page.tsx  neighborhoods/[slug]/page.tsx
│  │  ├─ api/predictions/rent/route.ts      proxy (disabled unless configured)
│  │  └─ api/market/*/route.ts               one GET per MarketDataSource method (D-022)
│  ├─ components/                   presentational, no data access
│  │  ├─ ui/          Button Field Select ChoiceGroup Dialog Disclosure StatusPanel
│  │  ├─ layout/      SiteHeader (incl. mobile nav) SiteFooter LegendRail nav-items; skip link + page-grid utility in the root layout/CSS
│  │  ├─ provenance/  ProvenanceMark ProvenanceLabel Plate provenance-copy
│  │  ├─ maps/        RingPlate LocatorPlate BezirkSilhouette (SVG) · ExploreMap (client, MapLibre)
│  │  └─ charts/      LineChart BarChart Histogram DotPlot TableView ChartTooltip
│  ├─ features/                     stateful compositions; own their hooks and URL state
│  │  ├─ property-analysis/   neighborhood-explorer/   market-intelligence/
│  │  ├─ neighborhoods/       property-comparison/
│  ├─ lib/
│  │  ├─ contracts/rent-prediction.v1.ts     Zod: request, response, error (DRAFT)
│  │  ├─ api/prediction/                     service, transports/{disabled,http}, config, errors
│  │  ├─ data/geo/                           typed accessors + generated/ (server-only)
│  │  ├─ data/market/                        MarketDataSource interface, demo-source, index, http (server-only)
│  │  ├─ market/                             filter parsing (URL and API) and response schemas (client-safe)
│  │  ├─ fixtures/demo/                      ONLY imported by data/market/demo-source.ts
│  │  ├─ validation/                         property input schema, messages
│  │  ├─ formatting/                         numbers, currency, units, slugs
│  │  ├─ url-state/                          typed searchParam parse/serialize
│  │  └─ storage/                            versioned local/session storage
│  ├─ types/                                 provenance, geo, property
│  └─ styles/tokens.css, globals.css
└─ tests/{unit,component,e2e,contracts/fixtures}/
```

### Dependency direction (enforced by ESLint `no-restricted-imports` plus a boundary test)

```
app ──▶ features ──▶ components ──▶ (ui primitives)
  │         │             │
  └────────▶ lib ◀────────┘     lib never imports from app/features/components
lib/fixtures/** ◀── ONLY lib/data/market/demo-source.ts
lib/data/geo/generated/** ◀── ONLY lib/data/geo/*.ts (server-only module)
tests/contracts/fixtures/** ◀── ONLY tests/**
```

## 3. Routes

| Route | Rendering | Server data | Client islands | URL state |
|---|---|---|---|---|
| `/` | Static | geo meta + SVG plate paths | Ring Plate interaction, AnalysisEntry | — |
| `/analyze` | Static shell | Bezirk → Ortsteil options | PropertyAnalysisForm, ResultPanel | prefill only: `bezirk, ortsteil, type, area, rooms` |
| `/explore` | Static shell; `ExploreMap` via `next/dynamic` (`ssr: false`) | Ortsteil list (SSR, usable before the map loads) | map, list, panel, filters | `o, bezirk, ring, q` (`history.replaceState` from user actions, D-037) |
| `/market` | Static shell with the default view prerendered; other filters fetched per module from `/api/market/*` (D-022) | `MarketDataSource` (demo), default filters only | filter rail, four chart modules | `bezirke, from, to, type` (`history.replaceState` from user actions, D-040) |
| `/neighborhoods` | Static (all 97 rows in the HTML) | all 97 meta rows | filter rail + A–Z table | `bezirk, ring, q` (`history.replaceState` from user actions, D-037, D-045) |
| `/neighborhoods/[slug]` | SSG, `generateStaticParams` (97). `dynamicParams` isn't available with Cache Components, so other slugs render on request and call `notFound()` (D-043) | one Ortsteil + neighbors + locator paths; market provenance for the demo module | none (links only) | — |
| `/compare` | Static shell | Bezirk/Ortsteil options | comparison store, dialogs | — (storage) |
| `/methodology` | Static | dataset registry | none | anchors |
| `POST /api/predictions/rent` | Route handler (Node), dynamic | — | — | — |
| `GET /api/market/{rent-trend,districts,distribution,property-types}` | Route handlers, dynamic, `no-store` | one `MarketDataSource` call each, returning `{ provenance, data }` | — | strict query: `bezirke` (codes), `from`, `to`, `type`; 400 with a reason |

Client components that read `useSearchParams` are wrapped in `<Suspense>` with a static fallback, so the pages stay statically rendered.

## 4. State boundaries

| State | Lives in | Mechanism |
|---|---|---|
| Static reference data (geo; demo market for the default view) | Build output | Server components → props |
| Market answers for other filters | Module state on `/market` | `fetch` to `/api/market/*`, Zod-parsed, aborted when stale (D-022) |
| Shareable view state (filters, selection) | URL | `lib/url-state` typed parsers (Zod `safeParse` on read; invalid → default plus a notice) |
| Form state | React Hook Form | The `propertyInputSchema` resolver |
| Analysis draft | `sessionStorage` (`bhai.analyze.draft.v1`) | Written on every change once it has been read (D-034), Zod-validated read |
| Comparison | `localStorage` (`bhai.compare.v1`) | A small external store + `useSyncExternalStore`, with cross-tab `storage` events |
| UI ephemera | Component state | `useState` |

There is no global store. If a second feature ever needs comparison state, it imports the store module; it doesn't use a context provider tree.

## 5. Forms and validation

- `lib/validation/property.ts` holds the **UI-shaped** schema (`PropertyInput`). It allows "not_sure" values, half rooms, and cross-field refinements (floor ≤ total floors, Ortsteil ∈ Bezirk). The same schema is used by:
  - the `/analyze` resolver
  - the `/compare` dialog (extended with `askingColdRent`, `label` and `listingUrl`)
  - URL prefill (`.partial().safeParse`)
  - storage reads
- `lib/contracts/rent-prediction.v1.ts` holds the **wire-shaped** schema. `toRentPredictionRequest(input: PropertyInput): RentPredictionRequestV1` is the **only** mapping between them, and it is unit-tested field by field: "not_sure" → `null`/`"unknown"`, names → official ALKIS names, and the code is included.
- Error messages live in `lib/validation/messages.ts`. They name the field, the rule and the fix.
- Submit behavior: validate everything, render an error summary (a focusable region named by its heading, links to fields), and focus the summary (D-032). Field errors first appear on submit, then update live while the user is correcting (D-033). Blur validation was dropped because the inserted error moved the submit button mid-click.
- Cross-field refinements use Zod's `when`, so they report as soon as the fields they compare are valid, even while other required fields are still empty.

## 6. Geo pipeline and rendering

```
data/raw/geo/*.geojson ──scripts/build-geo.mjs (mapshaper)──▶
   src/lib/data/geo/generated/
      ortsteile.meta.json   [{code:"0102", name, slug, bezirkCode,
                              areaKm2, ringShare, ringStatus, neighbors:[codes], labelPoint, bbox}]
      bezirke.meta.json     [{code, name, slug, areaKm2, labelPoint, bbox, ortsteilCodes}]
      plates.geo.json       heavy simplification, wound for d3-geo (SVG plates, home, locators)
   public/geo/
      ortsteile.geojson  bezirke.geojson  ring.geojson   moderate simplification (MapLibre)
```

The build **fails** unless all of these hold:
- 12 Bezirke and 97 Ortsteile
- every Ortsteil maps to a Bezirk, via the `sch` code cross-checked with point-in-polygon
- slugs are unique
- adjacency is symmetric
- the Ortsteil area sum is within 0.5 % of the Bezirk area sum
- the total is within 1 % of the official 891 km²
- the payload sizes are inside budget

Derivation rules are specified in DATA_BOUNDARIES §6.

**SVG plates** (`RingPlate`, `LocatorPlate`, `BezirkSilhouette`) are server components. They project with `d3-geo` (`geoMercator().fitSize`, a conformal projection that is fine at city scale) and emit plain `<path>` elements. Interactivity is a thin client wrapper that handles hover, focus, the tooltip and selection via event delegation on `data-code` attributes. Each Ortsteil path is focusable only in the hero's "explore the plate" mode, so the page doesn't become 97 tab stops. Otherwise the linked list is the keyboard path.

**MapLibre** runs on `/explore` only:
- an inline style object with no remote style and no glyph server; labels are `aria-hidden` HTML overlays (D-038)
- data loaded from `/geo/*.geojson` after first paint
- `feature-state` for hover and selection
- a WebGL2 check before the module is requested, with the SVG `RingPlate` and the list as the fallback; the worker is served from `/vendor` (D-038)

The optional basemap (OpenFreeMap) is behind `NEXT_PUBLIC_ENABLE_BASEMAP`, which is off by default, and its terms are reviewed before it's enabled.

## 7. Charts

- `components/charts/`: `LineChart`, `BarChart`, `Histogram` and `DotPlot` on a shared `ChartFrame`, plus `TableView` and `ChartLegend`. Each chart is a client component. It takes its data, a required `provenance`, an accessible `label` and its formatters, so a chart cannot render without declaring its data origin. The module around it (a `Plate`) carries the question title, the band and the method note.
- Implementation:
  - d3-scale/d3-shape compute the geometry. Our own SVG draws the axes and marks.
  - `ChartFrame` measures its box (`ResizeObserver`) and draws only once measured. The server-rendered box already has its final size.
  - Colors are token utilities (`stroke-series-1`, `fill-seq-2`), never hard-coded hex.
  - A demo source draws its label inside the SVG (`ProvenanceStamp`).
- Keyboard: one `role="slider"` per chart. The arrow keys move a crosshair (time, bins) or the row focus (bars, dots), and `aria-valuetext` carries the readout. The visual tooltip is `aria-hidden`, and Esc dismisses it (D-042).
- `TableView` renders the same data as a `<table>` with a caption (scope and provenance words) and units, inside a native "Show table" disclosure that works before JavaScript.

## 8. Prediction integration (summary; the contract is in [PREDICTION_API.md](../contracts/PREDICTION_API.md))

```
PropertyAnalysisForm ──(PropertyInput)──▶ PropertyAnalysisService.estimateRent()
       │                                        │ toRentPredictionRequest()  (lib/contracts)
       │                                        ▼
       │                              PredictionTransport (interface)
       │                     ┌──────────────┼───────────────────────┐
       │              DisabledTransport   HttpTransport(direct)   HttpTransport(proxy)
       │              (default)           NEXT_PUBLIC_API_BASE_URL  /api/predictions/rent → PREDICTION_API_BASE_URL
       ▼                                        │
ResultPanel ◀── RentEstimateOutcome (discriminated union: ok | not_connected | invalid_input | unavailable | rejected)
```

- The transport is chosen once, in `lib/api/prediction/config.ts`, from `NEXT_PUBLIC_PREDICTION_MODE`.
- Responses are parsed with the Zod response schema. A response that doesn't parse becomes `unavailable` with code `INVALID_RESPONSE`. It is never rendered half-parsed.
- `ResultPanel` renders every outcome. The `ok` view is built and tested **only** against `tests/contracts/fixtures/*`. Those fixtures can never be imported from `src/` (boundary rule).

## 9. Environment

| Variable | Scope | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_PREDICTION_MODE` | client (build-time) | `disabled` | `disabled` \| `direct` \| `proxy` |
| `NEXT_PUBLIC_API_BASE_URL` | client | — | `direct` mode only: a public, CORS-enabled FastAPI base URL |
| `PREDICTION_API_BASE_URL` | **server only** | — | `proxy` mode upstream |
| `PREDICTION_API_KEY` | **server only** | — | Optional upstream credential. Never prefixed `NEXT_PUBLIC_`. |
| `PREDICTION_TIMEOUT_MS` | server | `10000` | Upstream timeout |
| `NEXT_PUBLIC_ENABLE_BASEMAP` | client | `false` | Optional OpenFreeMap basemap on `/explore` |

`.env.example` is committed. `.env*.local` is gitignored. `NEXT_PUBLIC_*` values are inlined at build time, so switching the prediction mode or the public API URL needs a rebuild. Server-only variables are read at runtime. `lib/api/prediction/config.ts` validates the env with Zod at startup and fails fast if `direct` mode has no URL.

## 10. Performance budgets

| Item | Budget |
|---|---|
| First-load JS per route (gzip) | ≤ 150 kB. `/explore` is excluded only for the lazily loaded MapLibre chunk. |
| Inline SVG for the home Ring Plate | ≤ 90 kB raw HTML contribution |
| `public/geo/*.geojson` total (gzip) | ≤ 300 kB |
| Fonts | 2 variable families, subset `latin` + `latin-ext` (German diacritics) |
| LCP (mobile profile) | ≤ 2.5 s |

## 11. Error, loading and empty conventions

- Route-level `error.tsx` uses `StatusPanel`, which says what failed and offers retry plus a home link.
- Module-level errors (one chart) are contained by a small error boundary per module.
- Loading: SSG pages have none. The map shows "Loading map…" over the plate fallback. Submitting the analysis puts the button in a busy state (`aria-busy`) with no spinner overlay.
- Empty states: always an explanation plus the next action.

## 12. Testing strategy

| Layer | Tool | What |
|---|---|---|
| Unit | Vitest | Zod schemas (bounds, refinements, messages); `toRentPredictionRequest` mapping; slug rule (`Köpenick→koepenick`, `Weißensee→weissensee`, `Schöneberg→schoeneberg`); formatters; URL-state parsers; storage versioning |
| Geo build | Vitest over generated files | the asserts listed in §6 |
| Contract | Vitest + MSW-free fetch mocks | `HttpTransport` maps 200, 422 (contract and FastAPI-default shapes), 429, 503, 504, network and invalid JSON to outcomes; `DisabledTransport` → `not_connected` |
| Boundaries | Vitest scanning imports + ESLint | no `fixtures` import outside the demo source; no `tests/` import from `src/`; no `NEXT_PUBLIC_*KEY*` vars |
| Component | Testing Library | form: required errors, summary focus, Bezirk change clears Ortsteil, tri-state, progress counts; compare: add, replace, remove, persist, corrupt storage |
| E2E | Playwright (Chromium; WebKit at QA) | Flows 1–5 from USER_FLOWS at 375 × 812, 768 × 1024 and 1440 × 900 |
| Accessibility | @axe-core/playwright on every route and key state | 0 serious or critical; manual keyboard pass via the `accessibility-review` skill |
| Visual | Playwright screenshots → reviewed by eye per slice | stored under `tests/e2e/__screenshots__/` (not pixel-diffed in this phase) |

Scripts: `dev`, `build`, `start`, `typecheck` (`tsc --noEmit`), `lint` (`eslint .`), `test` (`vitest run`), `test:e2e` (`playwright test`), `geo:build`, `fixtures:build`, and `check` (typecheck + lint + test + build).

## 13. Next.js specifics

- `next.config.ts` sets `turbopack.root` and `outputFileTracingRoot` to the project directory. The parent home folder contains an unrelated `package.json` and lockfile, and Turbopack might otherwise infer the wrong workspace root.
- `lib/data/geo` imports `server-only`.
- `typedRoutes: true` if it's stable in 16.x (verified at scaffold).
