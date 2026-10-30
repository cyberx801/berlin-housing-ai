# Decision Log

Format: ID · title · status (Accepted / Proposed / Pending verification / Superseded) · context → decision → consequences. Append only. Superseded entries stay, marked as superseded.

---

### D-001 · Project location · Accepted (confirm with owner)
The working directory was the user home folder, which isn't a repository and holds an unrelated `package.json`, lockfile and `node_modules`. No Berlin Housing project was found on the C: drive (the only drive) in the usual places (Desktop, Documents, Downloads, OneDrive, PycharmProjects).
→ A new repository was created at `C:\Users\fozma\berlin-housing-ai` with git initialized and no commits. If an existing repository should be used, the docs and data move there unchanged.
→ Next config pins the workspace root (D-003).

### D-002 · Visual direction "Atlas" · Proposed (awaiting client review)
→ Concept B was selected over Raster and Grundriss. Rationale and critique: DESIGN_DIRECTION.md. One element is borrowed from Grundriss: the floor indicator.

### D-003 · Next.js 16 / React 19 / TypeScript pinned below 7 · Accepted (verified, see D-024)
npm `latest` on 2026-10-29: next 16.4.3, react 19.3.1, typescript **7.0.2**. TypeScript 7 is the native compiler, while Next's build-time type check and typescript-eslint depend on the TypeScript JS API.
→ Pin TypeScript to 5.9.3, or 6.0.x if typescript-eslint's peer range allows it. Record the verified combination here.
→ Check whether `next lint` exists in 16.x, and use `eslint .` regardless.
→ Set `turbopack.root` and `outputFileTracingRoot`.

### D-004 · Maps: MapLibre on `/explore` only, SVG plates elsewhere, no basemap by default · Accepted
→ The homepage, locators and silhouettes use server-rendered d3-geo SVG. That means no WebGL, it's accessible and SSR-able, and no JavaScript is needed to see it.
→ `/explore` uses MapLibre via dynamic import, with an inline style and our own GeoJSON. No key and no third-party requests.
→ The optional OpenFreeMap basemap is gated behind a flag after a terms review.
→ Consequence: no street context by default. Acceptable, because the product question is about Ortsteil-level context, not navigation.

### D-005 · Charts: visx primitives + d3 · Superseded by D-025
Recharts and similar libraries have defaults that look generic and are hard to make keyboard-accessible. Observable Plot is imperative.
→ visx 4 (peer `react ^19` verified) plus our own components, giving full control of tokens, tooltips, keyboard and table views.

### D-006 · Forms: React Hook Form + Zod 4 · Accepted
→ RHF 7.91 with `@hookform/resolvers` 6.0.2 (peer `zod ^4` verified). One UI-shaped schema, mapped once to the wire schema.

### D-007 · Accessible primitives: native first, React Aria Components where native falls short · Superseded by D-026
→ Native `<select>`, `<details>` and radio groups. React Aria Components only for Combobox (Ortsteil search), Dialog/Modal and Popover. Version to be verified at scaffold.

### D-008 · Prediction transport: disabled by default, proxy recommended · Accepted
→ `NEXT_PUBLIC_PREDICTION_MODE=disabled|direct|proxy`. `NEXT_PUBLIC_API_BASE_URL` exists for a public, CORS-enabled FastAPI (as the brief suggested). The **proxy** route with the server-only `PREDICTION_API_BASE_URL`/`PREDICTION_API_KEY` is recommended because it keeps secrets server-side, avoids CORS, and maps errors in one place.
→ The disabled transport returns a typed `not_connected` outcome and never throws.

### D-009 · Provenance as a required, typed prop + visual notation · Accepted
→ Every data-bearing component requires `provenance`. There are five fixed visual states (DESIGN_SYSTEM §7). The demo label is drawn inside the SVG too.

### D-010 · Areas computed from geometry; ALKIS `gdf` ignored · Accepted
Evidence (2026-10-29): `gdf` ≈ the computed area for single-part features (median ratio 0.996), but it is wrong for some multi-part features (Blankenfelde 139 vs ≈ 13.3 km²; Buckow ×3.9).
→ Geodesic area of the raw geometry, computed in the build.

### D-011 · "Ring" = official Umweltzone polygon; status by area share · Accepted
→ The Umweltzone is officially defined as the area inside the S-Bahn ring. The thresholds are `inside` ≥ 95 %, `outside` ≤ 5 %, and `partly` in between. The share is shown on profiles, and the method is on `/methodology`. It is never called track geometry.

### D-012 · UI language: English, with official German place names · Accepted (revisit for i18n)
→ The audience includes international newcomers. Place names keep their umlauts and ß. German terms are explained at first use. Strings are kept in a structure that can be extracted later.

### D-013 · No motion library · Accepted
→ CSS transitions + View Transitions API. One orchestrated moment: the ring draw-in. `motion` (14.7.1) is not added unless a specific interaction needs it.

### D-014 · Demo market fixtures: seeded, plausible in shape, isolated, always labeled · Accepted
→ Per the brief, demo mode may use plausible values. Mitigations: hatched band, in-SVG label, an import boundary, never in meta or marketing, and seeded generation (no hand-typed "realistic" numbers).

### D-015 · Tri-state booleans and explicit "Not sure" options · Accepted
→ Lift and balcony are Yes / No / Not sure → `true / false / null`. Categorical optionals have "Not sure" → `"unknown"`. Defaulting to `false` would put invented facts into the model input.

### D-016 · Rooms in half steps · Accepted
→ Berlin listings count half rooms ("2,5 Zimmer"). Range 1–10, step 0.5.

### D-017 · No geocoding in this phase · Accepted
→ Address is free text, used only as a user label, and never sent to a third party. `lat`/`lon` stay `null`. Reasons: Nominatim's usage policy disallows autocomplete-style use, and paid geocoders are out of scope. Revisit with a self-hosted or licensed geocoder.

### D-018 · No global state library · Accepted
→ URL, RHF, a small external store for compare, and component state (ARCH §4).

### D-019 · No unlabeled sample prose about real neighborhoods · Accepted
→ The brief allows "explicitly presented sample editorial content", but invented descriptions of real places can mislead even with a label. Decision: character modules show only sourced claims, or "Not written yet". Can be revisited if the owner wants labeled samples for a demo.

### D-020 · Dark mode is secondary · Accepted
→ Tokens are defined and validated (DESIGN_SYSTEM §2.3, §8). It ships in slice 9 only after full QA. Otherwise `color-scheme: light`.

### D-022 · `/market` data loading model: route handlers per module · Accepted (slice 5)
The question was how `/market` loads its data. The options were (a) server components reading `searchParams`, which would relax `ensureStatic` (D-027), or (b) a client fetch through route handlers. Either way the `MarketDataSource` interface had to stay.
→ **Option (b).** The page stays static.
  - At build time it asks the source for the default filters. It renders all four modules and their tables into the HTML.
  - Any other filter set is fetched by the client from one GET route per `MarketDataSource` method: `/api/market/rent-trend`, `/districts`, `/distribution` and `/property-types`.
  - Each route returns `{ provenance, data }`, so the bands and the in-SVG label follow the source.
→ **Why not props with client-side filtering.** Client components may not import `@/lib/data/*` (boundary test), so that approach would have put the query logic outside the interface.
→ **Where things live.** Shared types are in `src/types/market.ts`. Query parsing and the Zod response schemas are in `src/lib/market/`.
→ **Validation and errors.**
  - The handlers parse the query strictly (`parseApiQuery`). Bad input gets a 400 `INVALID_QUERY` with a reason.
  - A source failure gets a generic 500 `SOURCE_FAILED`. Responses are `no-store`.
  - The client parses every response. One that doesn't parse counts as a failed module.
→ **Fetching.**
  - Each module fetches only the fields it uses, so a Bezirk change doesn't refetch the district comparison.
  - Stale requests are aborted. A query that is already loaded is never refetched, even though Activity re-runs effects.
  - On refetch the previous chart stays on screen, dimmed and `aria-busy`, with no skeleton.
  - A failed module shows its own error with "Try again". A render error is caught by a per-module boundary.
→ **Real source.** One that does I/O will need `"use cache"` (or a Suspense boundary) for the build-time default view. The demo source resolves synchronously.

### D-021 · Chart series caps from palette validation · Accepted
→ All-pairs forms (maps, scatter, small multiples) are capped at 3 colored series, and trend lines at 4 Bezirke. The district comparison uses one hue with outline selection. Source: `validate_palette.js` runs on 2026-10-29 (DESIGN_SYSTEM §8.1).

### D-023 · Number and unit formatting: en-GB · Accepted
`en-DE` (English text, German conventions) was tried first, but its Intl output is inconsistent (decimal commas next to comma-grouped currency in some engines).
→ One locale, `en-GB`, everywhere: `€1,150`, `€17.69 /m²`, `7.7 km²`, `83 %`. Units follow the value after a narrow no-break space. Input parsing still accepts the German decimal comma (`65,5`).
→ Lives in `src/lib/formatting/number.ts`, unit-tested.

### D-024 · Toolchain verified at scaffold (resolves D-003) · Accepted
Verified on 2026-10-29 with Node 22.16 / npm 10.9:
→ next 16.4.3, react 19.3.1, **typescript 5.9.3**, eslint 9.39.5 with eslint-config-next 16.4.3 (its typescript-eslint accepts TS 5.9), tailwindcss 4.3.3 via `@tailwindcss/turbopack`, vitest 5.0.5, jsdom **29.1.1** (30.x warns on Node 22.16's engine range), @playwright/test 1.64.1.
→ `next lint` no longer exists; `npm run lint` runs the `eslint` CLI. `npm run typecheck` runs `next typegen` first so the global `PageProps`/`LayoutProps` types exist.
→ `turbopack.root` and `outputFileTracingRoot` are set because the home folder has an unrelated lockfile.

### D-025 · Charts: d3 modules + our own SVG; visx not used (supersedes D-005) · Accepted
→ d3-scale, d3-shape and d3-array are already needed (and d3-geo for plates). visx's scale/shape wrappers would duplicate them, and axes, tooltips, keyboard handling and table views are custom anyway. Fewer dependencies, same control.

### D-026 · Native dialog and select; React Aria dropped (supersedes D-007) · Accepted
→ `Dialog` is a native `<dialog>` opened with `showModal()` (inert background, Esc, focus return). The Ortsteil choice on `/analyze` is a native select filtered by the chosen Bezirk (at most 15 options), so no combobox is needed. `/explore` search is a text field that filters the synced list.
→ `react-aria-components` was installed during scaffolding and removed before any use.

### D-027 · Whole app is statically rendered · Accepted
→ `cacheComponents` is on and the root layout exports `ensureStatic = "navigation"`, so the build fails if any page becomes request-time work. Consequences: `[slug]` routes need `generateStaticParams`; client components that read `useSearchParams` sit inside `<Suspense>`; URL state is read on the client.
→ Activity keeps up to three hidden routes mounted. Element ids must therefore be unique across routes (explicit `id`/`idPrefix` props), dialogs and menus close when their route is hidden, and CSS animations that should run once are removed after they finish.

### D-028 · `exactOptionalPropertyTypes` left off · Accepted
→ It conflicts with many library prop types that pass `undefined` explicitly. Where the distinction matters (outcome objects, request options), code uses conditional spreads instead. `strict` and `noUncheckedIndexedAccess` are on.

### D-029 · Provenance kinds and their five visual states · Accepted
→ The `Provenance` type has seven kinds mapped to the five notations of D-009: `official` and `model` (solid ink band), `user` and `research` (ink-2 band), `demo` (45° hatch), `not-connected` (dashed frame), `pending` (plain outline, "Not written yet"). Each kind carries the fields its label needs (license, fixture note, missing capability, reason).

### D-030 · Place references in URLs use slugs · Accepted
→ Every URL that names a place uses its slug: `/analyze?bezirk=mitte&ortsteil=moabit`, `/neighborhoods?bezirk=mitte`, `/explore?o=moabit`. Pages map slugs to official codes. Codes stay internal (form values, contract `ortsteil_code`).

### D-031 · Homepage plate: keyboard path is a native select, paths are not focusable · Accepted
→ The 97 Ortsteil paths respond to pointer hover and tap, but are not tab stops. A native "Find an Ortsteil" select (grouped by Bezirk) is the keyboard and screen-reader path, and it drives the same highlight and readout (PRD A2). Small multiples share one map scale so Bezirk sizes stay comparable.

### D-032 · `/analyze` submit errors: focus goes to the error summary · Accepted
→ PRD B4 said "focus moves to the first invalid field", while FRONTEND_ARCHITECTURE §5, USER_FLOWS Flow 1 and the accessibility skill said "focus the summary". The summary wins: it states how many fields need fixing and links to each one, and each link moves focus to its control (radio groups: the checked or first radio). PRD B4 is corrected. The three-field homepage entry keeps first-field focus, as before.

### D-033 · `/analyze` validates on submit, then live while correcting · Accepted
→ Supersedes "errors appear on blur" in FRONTEND_ARCHITECTURE §5. Measured in Chromium at 1440 px: with blur validation, pressing "Prepare analysis" while an invalid field is focused inserts that field's error between pointer-down and pointer-up. The button moves 27 px and the click is lost. React Hook Form now runs `mode: "onSubmit"` and `reValidateMode: "onChange"`, which is also how the homepage entry behaves.
→ Cross-field rules (floor ≤ total floors, Ortsteil in Bezirk) run with Zod's `when` as soon as the fields they compare are valid. Zod otherwise skips object refinements while any other field has an issue, which hid them until every required field was filled.

### D-034 · `/analyze` URL prefill is applied once and starts a new description · Accepted
→ A link with `bezirk`, `ortsteil`, `type`, `area` or `rooms` fills an empty form with the valid values. Invalid values are left empty and listed in a notice. The parameters are then removed from the URL with `history.replaceState` (Next syncs `useSearchParams`), so a reload restores the user's edits from the session draft instead of re-applying the link.
→ If the tab already held a draft, the link replaces it, and "Bring back your earlier entries" restores it. Mixing fields from two different flats silently would be worse.
→ The draft is written on every change. It is small and `sessionStorage` is synchronous, and a debounce would lose the last keystrokes on a quick reload. Nothing is written until the draft has been read, so empty defaults can never overwrite a stored draft.

### D-035 · `/analyze` below 1024 px: progress strip with its own submit; no sticky bottom bar · Accepted
→ DESIGN_DIRECTION shows "Prepare analysis" sticky at the bottom on mobile. A bottom bar would cover the focused field and the on-screen keyboard's neighbourhood (WCAG 2.4.11). Instead, the sticky top strip carries "Required fields: n of 4" and a small "Prepare analysis" button, and a full-size button ends the form.
→ Below `lg`, form elements get `scroll-margin-top` equal to the strip height, on top of the global `scroll-padding-top`. An E2E test tabs backwards through the form at 375, 768 and 1440 px and checks that no focused element sits under the header or the strip.

### D-036 · Prediction proxy route behaviour · Accepted
→ `POST /api/predictions/rent` reads `PREDICTION_API_BASE_URL`, `PREDICTION_API_KEY` and `PREDICTION_TIMEOUT_MS` at request time (server only). A malformed value counts as "not configured" and is logged, never guessed.
→ Request handling: bodies over 16 kB get 413, non-JSON gets 400 and a contract mismatch gets 422 (all `VALIDATION_ERROR` envelopes), all before any upstream call. Without a base URL the answer is 503 `PREDICTION_ENGINE_NOT_CONFIGURED`, which the browser shows as "not connected".
→ Upstream handling: a timeout gives 504 `UPSTREAM_TIMEOUT` and a network failure 502 `UPSTREAM_UNREACHABLE`, both retryable. Upstream JSON passes through unchanged with `Retry-After`. A non-JSON upstream body is dropped, so only the status reaches the browser and is mapped exactly as in direct mode. The key is sent only as the upstream `Authorization` header. The `X-Request-ID` is echoed only if it is a safe token.

### D-037 · `/explore` URL state: read through a Suspense reader, written only by user actions · Accepted
→ Supersedes `router.replace` in FRONTEND_ARCHITECTURE §3. `o`, `bezirk`, `ring` and `q` are written with `history.replaceState`, which Next syncs with `useSearchParams` without a server round trip. Writes happen only in event handlers (select, close, filter, search), never in an effect keyed on state: a hidden route's effects re-run when it is shown again (D-027), and an effect-driven write could then land on another route's URL. Search input waits 400 ms before writing, which also stays under Safari's `replaceState` rate limit.
→ The query is read by `SearchParamsReader` inside `<Suspense>`, so the list, filters and panel stay in the static HTML. The reader ignores echoes of our own writes and a query equal to the current state, so typing is never overwritten by a late echo. Anything else is a real navigation and is applied. Unknown slugs or ring values are dropped, the URL is rewritten without them and the visitor is told.
→ Filter parsing (`bezirk`, `ring`, `q`) lives in `features/neighborhood-explorer/filters.ts` for `/neighborhoods` to reuse in slice 6. Name search folds case, accents, ß and hyphens and also matches the German transliteration ("neukolln" and "neukoelln" both find Neukölln).

### D-038 · MapLibre setup on `/explore` · Accepted
→ MapLibre 6 needs WebGL2. That is checked on a throwaway canvas before `next/dynamic` requests the map module, so browsers without it never download about 300 kB gzip. The server-rendered SVG plate fills the map area while the module loads and stays as the fallback (with an explanation) when WebGL2 is missing. Pointer selection works on it, and the list is always the keyboard path.
→ MapLibre 6 finds its worker next to its own module via `import.meta.url`, which a bundled chunk can't satisfy. `scripts/copy-maplibre-worker.mjs` runs before `dev` and `build`, copies the worker to `public/vendor/maplibre-gl-worker-<version>.js` (gitignored), and the map calls `setWorkerUrl()` with it. GeoJSON URLs are absolute because the worker resolves URLs against its own address.
→ Sources use `promoteId: "code"`. The GeoJSON `id` is numeric, so "0102" would become 102 and Bezirk "01" would become 1. Selection, hover and filter dimming are feature-state.
→ There is no glyph server, so there are no symbol layers. Labels are `aria-hidden` HTML spans placed greedily by priority (selected first, then larger areas), skipped where they collide or fall under the details panel. Zoom buttons and the attribution line are our own components. Colours are read from the CSS tokens at runtime.
→ MapLibre's stylesheet is unlayered and beats Tailwind's layered utilities (`.maplibregl-map { position: relative }`), so the map container fills a positioned wrapper instead of positioning itself.
→ The demo choropleth toggle (PRD C6) is optional. The fixtures exist since slice 5. It is scheduled for slice 9, behind an explicit, default-off toggle with hatched labelling.

### D-039 · `/explore` layout: one DOM, two arrangements · Accepted
→ From `lg`, the list and filters form the left rail (3 of 12 columns), which scrolls on its own. The details panel docks over the map's right edge, and camera fits and label placement leave that strip free. The whole explorer is sized to fit under the page title, so the attribution is visible without scrolling.
→ Below `lg`, the map takes the top 55 % of the viewport above a tablist (List / Details) and a sheet that scrolls on its own, as USER_FLOWS Flow 3 asks. The sheet is a region, not a modal. Selecting switches to Details, and focus follows only if it was in the list that just hid. Short viewports (under 34rem, such as landscape phones or page zoom) drop the split and let the page scroll. Tab roles are set only below `lg`.

### D-040 · `/market` filter scope per module · Accepted
→ One filter set applies to the whole page: Bezirke (at most 4), a period in whole years, and a property type. Each module states its own scope in a sentence under its title, so no chart silently disagrees with the filters.
  - **Rent trend:** one line per chosen Bezirk, colored by slot. With no Bezirk chosen, one all-Berlin line. Type and period apply.
  - **District comparison:** always all 12 Bezirke in one hue. Chosen Bezirke get an ink outline, a bold name and the word "selected". Type and period apply.
  - **Price distribution:** the chosen Bezirke combined, or all of Berlin if none. Type and period apply.
  - **Property types:** the chosen Bezirke combined, or all of Berlin if none. It shows every type and outlines the chosen one instead of filtering.
→ The `MarketDataSource` signatures follow from this:
  - The distribution and the type comparison take `bezirke: BezirkCode[]`, combined. The first draft of DATA_BOUNDARIES §5 had a single optional Bezirk.
  - Every method takes the period as whole years (`from`, `to`).
→ Color follows the entity (dataviz rule):
  - A Bezirk keeps its slot while it is chosen. Removing one frees its slot, and a newly chosen Bezirk takes the lowest free slot.
  - The URL lists Bezirke in slot order, so a reload keeps the colors unless a slot was left empty.
→ A fifth Bezirk is refused, with the reason in a status line. The other boxes stay operable (`aria-disabled` plus a description), because native `disabled` would drop them from the tab order and hide why.
→ URL parameters: `bezirke` (slugs), `from`, `to`, `type`.
  - They are written with `history.replaceState`, from user actions only (the D-037 pattern).
  - Unusable parts of a link are dropped, the link is rewritten and the reader is told. That covers unknown Bezirke, more than four, an invalid period and an unknown type.

### D-041 · Demo market fixture model · Accepted (implements D-014)
→ **What is stored.** The generator simulates listings and keeps only aggregates:
  - monthly medians and counts per Bezirk (and all of Berlin) × type (and all types)
  - yearly 1 € histograms per Bezirk × type

  Any combination of Bezirke, years and types can be summed from the histograms. Medians and quartiles for a combination are read from the bins by linear interpolation.
→ **No real-world ordering.** The Bezirk levels (€9–18 /m², drawn in code order), volumes, type multipliers and type shares are seeded random draws. The result follows no real ranking. In the committed fixture, for example, Spandau sits above Charlottenburg-Wilmersdorf.
→ **The one fixed shape.** A city-wide drift of +0.3 % a month is a design constant, chosen so the trend lines have a slope to read. Only its noise is seeded. It makes the all-Berlin line rise from about €14 to €17 /m², the most claim-shaped thing on the page. The README and the module labels say it is synthetic, and the README names the drift as a constant.
→ **Deliberate gaps.** For each non-apartment type, one Bezirk picked by the seed has no listings, so the "No demo series for this combination" state can be reached. The empty state says the gap is deliberate and says nothing about which homes exist where.
→ **Determinism.** A unit test rebuilds the fixture and compares it byte for byte. `npm run fixtures:build -- --check` does the same outside the tests.

### D-042 · Chart interaction: one slider per chart · Accepted
→ **The slider.** Each chart has one focusable element with `role="slider"` over the plot.
  - Left/Right move the cursor for time and bins, Up/Down for rows. Home/End jump to the ends, and the Page keys step a sixth of the way.
  - Its `aria-valuetext` is the readout, e.g. "March 2024: Mitte €14.20 /m², …".
  - Why a slider: it puts screen readers into focus mode, so the arrow keys reach the chart. A focusable group wouldn't do that.
→ **What screen readers get.** The SVG itself is `aria-hidden`. The "Show table" disclosure is a native `<details>` that works before JavaScript, and it carries every value.
→ **Pointer and tooltip.**
  - Pointer and keyboard drive the same cursor.
  - The visual tooltip is `aria-hidden`, and Esc dismisses it (WCAG 1.4.13).
  - A tap keeps its readout until focus moves on.
→ **Rendering.**
  - Charts draw only after measuring their box. The server-rendered box already has its final size, so nothing shifts on hydration.
  - After a filter change, the previous render stays dimmed until the new answer arrives.
→ **Contrast.** The dot plot's interquartile band uses the sequential step `seq-2`, at 3.3:1 on the sheet. A translucent series color measured 1.6:1, which fails WCAG 1.4.11.

### D-043 · `/neighborhoods/[slug]`: 97 prerendered profiles, `notFound()` for anything else · Accepted
→ FRONTEND_ARCHITECTURE §3 planned `dynamicParams = false`. With Cache Components that export fails the build ("not compatible with `nextConfig.cacheComponents`"), so it is not used.
→ `generateStaticParams` returns all 97 slugs from the geodata, and the build lists 97 fully static pages. Any other slug renders on request: the page awaits `params` outside any Suspense boundary, finds no Ortsteil and calls `notFound()`, and `generateMetadata` does the same.
→ Verified on the production server: `/neighborhoods/not-a-place` answered 404 on the first request (cache MISS) and again on the second (HIT), so an unknown slug is never stored as a 200. The E2E spec asserts the status twice.
→ Observed only on this Windows machine: `/neighborhoods/Moabit` answers 200 with the Moabit page, because the case-insensitive file system resolves the prerendered `moabit.html`. `getNeighborhoodProfile("Moabit")` itself is `undefined` (unit-tested), so a case-sensitive host would answer 404. Not changed.
→ The unknown-slug state (USER_FLOWS Flow 2) lives in the root `not-found.tsx`: a GET search form (`next/form`, `action="/neighborhoods"`, field `q`) and the A–Z link. The form submits before JavaScript loads, and the directory applies `q` once it hydrates.

### D-044 · Profile content: verified facts first, honest modules after · Accepted
→ The order changes from the DESIGN_DIRECTION wireframe. The facts ledger sits beside the locator plate from `lg`, the nearby comparison follows, and the three modules without data come last, under "What this page can't tell you yet". Real data reads first.
→ **The market module shows no figures.** The source is keyed by Bezirk, so any number on `/neighborhoods/moabit` would be a Mitte number on a Moabit page. The module says market series exist per Bezirk only and links to the dashboard for that Bezirk.
  - The link is built with `marketQuery`, e.g. `/market?bezirke=mitte`.
  - Its band is the source's own `provenance` (demo today), so it follows the source when real data arrives. The "they are demo data" sentence shows only while the kind is `demo`.
→ **Transit** is `not-connected` ("No station dataset is registered yet"). It promises no dataset and shows no distance. **Character** is `pending`, with no prose about the place: descriptions need a citable source for each claim (DATA_BOUNDARIES §7).
→ **Shared names.** Six Ortsteile share their Bezirk's name (Mitte, Pankow, Spandau, Neukölln, Lichtenberg, Reinickendorf). They read "An Ortsteil of the Bezirk Mitte", not "of Mitte".
→ **Meta.** Titles and descriptions carry only geometry facts (name, Bezirk, area, ring status and share, neighbours), never market values. A unit test checks all 97 descriptions.
→ The demo fixture's provenance note now ends "…to build and test the market dashboard" instead of "this dashboard", since the note also appears on profiles. The fixture was regenerated (`--check` passes), and the version stays v1 because no value changed.

### D-045 · `/neighborhoods` directory · Accepted
→ **The list.** One A–Z table (German collation): Ortsteil (link), Bezirk, area (two fixed decimals, so a column lines up), ring status. Below `md` the Bezirk moves under the name and the column hides. The whole list is in the static HTML.
→ **Filters.** Search, Bezirk and ring status sit in a `role="search"` rail, sticky from `lg`. They reuse `features/neighborhood-explorer/filters.ts`:
  - Reading: `readPlaceFilter`.
  - Writing: `placeFilterQuery`, a wrapper over `exploreQuery` that leaves out the selection.
  - URL state follows the D-037 pattern (Suspense reader, `history.replaceState` from handlers only, echo suppression, search written after 400 ms).
→ **Count.** A polite live region announces it, 800 ms after typing stops. Enter in the search field opens the profile when exactly one Ortsteil matches.
→ **Leaving mid-delay.** A search still waiting on its 400 ms write is flushed before Enter navigates and on any click inside the directory (`onClickCapture`). Otherwise the route-hide cleanup would drop it, and Back would return without the search.
→ **No results.** The empty state lists each active filter with its own Remove button and offers "Clear all filters". The buttons vanish once results return, so focus moves to the control that changed: the search field, the Bezirk select or the "Any" radio.
→ **Known gap.** A link with filters shows all 97 rows until hydration applies them. This is the same pre-hydration issue as `/explore`, listed for slice 9.

### D-046 · Locator plate labels: placed, not just filtered · Accepted
→ Labels are constant-size HTML over a scaling SVG, so collisions depend on the rendered width. At 375 px, the labels for Köpenick's eleven neighbours overlapped.
→ `lib/geo/labels.ts` estimates each box from the label type, measured at about 5.9 px per character and 17 px tall. It places greedily:
  - The focus goes first, then the neighbours by projected area.
  - A label is dropped when it collides with one already placed or runs off the plate.
→ It runs twice. The first pass assumes a 288 px plate, a phone. The second assumes 448 px, the `@md` container width, and starts from the first pass's set, so the wider set always contains the narrower one. Labels that fit only the wider plate are `hidden @md:inline` on the plate's container. Dropped names are still in the borders list and the SVG description.
→ The caption mentions the ring only when its line crosses the frame (`locatorShowsRing`). Blankenfelde's plate, for example, says the ring lies outside the view.

### D-047 · `/compare` table: one table, two arrangements · Accepted
→ **Shape.** One `<table>`: each column is a property, each row one attribute (PRD F2). From `md` the attribute names are row headers. Below `md` they move to a label row above each value row, so three properties keep a third of the width each, and 360 px has no horizontal scroll (F5). Only `display` changes between the two: every value cell lists its column, row header and label row in `headers`, so both arrangements read the same to assistive tech.
→ **Header.** The property names stick under the site header (`thead` cells, up to three lines). The Edit / Remove row below them doesn't stick. Focusable cells keep a scroll margin clear of both (2.4.11).
→ **Rows.** Ortsteil, Bezirk, type, area, rooms; then the rent block (asking cold rent, €/m², predicted rent); then floor, total floors, building, features, transit, the user's note and the listing link. Empty and "Not sure" answers read "Missing" in text (F3); a missing rent adds "Add the asking rent", which opens the editor on that field. The note and link read "No note" / "No link".
→ **€/m²** is the asking cold rent divided by the living area, both from the user's entries, shown only when a rent was entered. The row says "from your entries", the plate band is "From your entries", and the caption says nothing on the page is a market estimate. It is arithmetic on the user's own numbers, not a prediction or a reference rent.
→ **Predicted rent** is one cell spanning all columns: "Model not connected", linked to the methodology. No column is ranked, highlighted or called a better deal.
→ **Departure from the wireframe:** no empty "Add a property" column. Its cells would be read as blank values; "Add a property" sits in the plate header instead.

### D-048 · Compare dialog: the `/analyze` fields plus three listing fields · Accepted
→ **Same fields.** `PropertyFields` was extracted from `/analyze` (its server-rendered `<main>` is byte-identical before and after). The dialog uses it with the `compare-editor-` id prefix, the same schema and the same messages. Two React Hook Form instances (property and listing) are validated together on save, with one error summary that takes focus.
→ **Listing fields**, all optional:
  - *Name*, up to 60 characters. Empty means `{Ortsteil or Bezirk}, {area}`. A name the dialog made up shows as empty when editing, so it follows a changed place or area.
  - *Asking cold rent*, €1 to €100,000. `parseEuroAmount` reads German and English input: one separator followed by exactly three digits groups thousands (`1.150`, `1,150`); followed by one or two digits it is the decimal mark (`950,50`); with both, the last one is the decimal mark (`1.150,50`, `1,150.50`). Anything else gets a message naming the fix.
  - *Link*, http or https only, through the same `listingUrlSchema` the stored comparison uses, so a saved item always reads back. Nothing is guessed: `www.example.org/…` is rejected with "starting with https://". The table shows the host and opens the link in a new tab (`rel="noreferrer"`), saying "(new tab)".
→ **Full comparison.** "Add a property" stays available; the dialog then requires choosing which property the new one replaces, in that column's place (USER_FLOWS Flow 5).
→ **Redundant entry (3.3.7).** If this tab has an `/analyze` draft, the add dialog offers "Fill in from your analysis" and saves the item with `source: "analysis"`. It reads the draft with `peekDraft`, which never removes a broken one: telling the user about that is `/analyze`'s job.
→ **No lost input.** Closing an add dialog keeps its entries in memory until the user leaves the page, and the next add offers them back with "Start with an empty form". Cancel on an edit discards the changes; the stored property is unchanged.
→ **Other tabs.** An edited property removed elsewhere: the dialog says so and the next save adds the entries as a new property. A comparison filled up elsewhere: the replace choice appears with an error.
→ **Loading.** The dialog is a `next/dynamic` chunk, fetched once the page is interactive. `/compare` first-load JS is 183.5 kB instead of 201.7 kB.

### D-049 · `Dialog` closes on unmount a task later · Accepted
→ The unmount cleanup (D-027: routes hidden by Activity close their dialogs) called `onClose` at once. The compare editor is mounted already open, and React StrictMode's development-only effect re-run closed it immediately. `onClose` now runs a task later, and a cleanup that is set up again straight away cancels it. A `close` event queued by that cleanup is ignored while the dialog is open. Hidden routes still close their dialogs and tell the owner.

### D-050 · `/compare` focus, announcements and first paint · Accepted
→ **Focus after a dialog closes:**
  - Add or replace: the property's column header.
  - "Add the asking rent": the column header, since the button is gone once a rent is set.
  - A plain edit: back to its Edit button (the native dialog's own return).
  - Remove: the comparison heading, or the empty state's heading if it was the last one.
  - Clear all: the empty state's heading.
→ **Announcements** go to a polite live region, written after the dialog has closed: while a modal is open the rest of the page is inert, and a message written there would not be read. Inside the dialog, its own live region carries the Bezirk/Ortsteil sync messages.
→ **Before hydration** the saved comparison can't be read, so the page shows "Reading the comparison saved in this browser." instead of an empty state, with a `<noscript>` note that the comparison needs JavaScript. `data-hydrated` on `#compare-view` marks the live page.
→ **Remove and Clear all** each ask in a small dialog that names what is deleted and says it can't be brought back.

### D-051 · The dataset registry on `/methodology#sources` · Accepted
→ **Source.** `data/PROVENANCE.md` stays the full, human-readable registry. The page renders `src/lib/data/registry.ts` (server-only), a typed list of the same datasets with plain-language fields. It doesn't parse the Markdown, which holds request strings, tables and notes meant for people working on the data.
→ **What comes from where.**
  - The checksums and the download date come from `generated/provenance.json`, which the geodata build writes from the files it actually read. They are read through `getGeoBuildInfo()` in `lib/data/geo`, validated with Zod like the other generated files.
  - The rest is written in the module.
  - The demo fixture's id and seed are written in too; the fixture itself is never imported (DATA_BOUNDARIES §5).
→ **Kept in step by `tests/unit/methodology.test.ts`.**
  - Every `## <id>` heading in `PROVENANCE.md` has a registry entry, and every entry has a heading.
  - The build's checksums equal the registry's and appear in `PROVENANCE.md`.
  - Download dates, licenses, service addresses and the demo seed match.
  - Services are base addresses, never a GetFeature request that would download the data.
  - A new dataset therefore can't reach the registry or the Markdown alone.
→ **Ring thresholds.** The geo module throws at load if the build's thresholds differ from `src/lib/geo/ring.ts`, which the page copy and the profiles read. No threshold is typed into the copy.

### D-052 · `/methodology` structure and anchors · Accepted
→ **Order.** The capability table first (PRD §3 as a real table, one row per capability, each linking to its section). Then one section per row in the table's order: geography (with areas, ring status, neighbors and simplified drawing), market figures, the research dataset, in development (the rent model, uncertainty and transit), your entries and neighborhood descriptions. Then known limitations, then the dataset registry.
→ **Anchors.** The ids live in `features/methodology/sections.ts`, used by the page, its contents list and the tests. Seven are fixed by existing links and must not be renamed: `sources`, `your-data`, `market-data`, `predictions`, `in-development`, `neighborhood-content`, `ring`. A unit test fails on any `/methodology#…` link in `src/` that has no section. An E2E test checks that each id appears once after other routes have been visited (Activity keeps them mounted).
→ **`#in-development`** is the umbrella every "Not connected" band links to. It covers the rent model (`#predictions`) and transit (`#transit`), and says nothing fills their space in the meantime.
→ **Contents first in the DOM** at every width: above the article on phones, the sticky left column from `lg`, scrolling on its own if a short window can't fit it. The reading and focus order match the drawing, unlike the legend rail on `/compare` (slice 7 finding).
→ **Copy rules.** No euro amounts anywhere on the page (an E2E check). The demo section says why the trend lines rise without quoting a level. The prediction contract is called a draft; the interval method and level are named as open questions. The "AI" in the name is said to refer to the model in development, which nothing on the site uses today. Examples (Moabit's key, Blankenfelde's area) take their values from the geodata. Blankenfelde's own area field (139 m², from the raw file) is checked against that file by a test.

### D-053 · Legend rails come first in the DOM; below `lg` the compare legend is a disclosure · Accepted (slice 9)
→ **Rule.** On every route the legend rail (or filter rail, or contents list) comes before the plate in the DOM, so the reading and focus order match the drawing at every width (WCAG 2.4.3, 1.3.2). `/compare` was the one exception (slice 7 finding): from `lg` its rail was drawn left of the table but came after it.
→ **`/compare` below `lg`.** Moving the rail first put four legend blocks (about 350 px) above the table on phones. Following DESIGN_SYSTEM §4, below `lg` the legend is a closed "Legend and sources" disclosure above the table, a two-column strip inside from `md`. From `lg` it is the sticky rail. The blocks are rendered once in each arrangement and only one is displayed, so there is one `<aside>` in the accessibility tree.

### D-054 · The chart texture channel and the "patterns" setting · Accepted (slice 9)
→ **When it is on.** Under `forced-colors`, in print, or when the reader ticks "Draw patterns in the charts" on `/market` (DESIGN_SYSTEM §8.5). Never by default.
→ **What it draws.**
  - Lines get a dash per categorical slot (slot 1 solid). The legend and filter keys are drawn as the same SVG line, so they carry the same dash.
  - Bars and histogram columns get a 45° line fill from one `<pattern>` (`#chart-texture-45`), rendered once by `/market`, so its id stays unique while other routes are mounted.
  - Dots keep their fill: each is one series, labelled by its row.
  - The 135° fill isn't needed: no chart in this phase has two filled series.
→ **Forced colors.** Chromium doesn't adjust SVG paint (other browsers not checked), so the Bezirk labels (ink on the system's dark Canvas) were close to invisible. Charts now opt out (`forced-color-adjust: none`) and paint themselves in system colors: text and marks in `CanvasText`, gridlines in `GrayText`, the selected Bezirke in `Highlight`.
→ **The setting** is kept in this browser (`localStorage` `bhai.chartPatterns.v1`). An inline head script sets `<html data-chart-patterns>` before first paint, so there is no flash in colour alone. If storage is blocked the setting still applies until reload, and the hint says it can't be kept.

### D-055 · Dark mode is not shipped in this phase · Accepted (slice 9)
→ D-020 required full QA before shipping. That means every route at three widths, including the MapLibre style, the SVG plates and the charts, re-validated against the dark surface. It wasn't feasible in this slice (machine memory limits the browser runs). The site keeps `color-scheme: light`. The dark tokens stay documented in DESIGN_SYSTEM §2.3 for a later slice.

### D-056 · No demo choropleth on `/explore` in this phase · Accepted (slice 9)
→ PRD C6 allows an optional "Show demo layer". It would paint generated demo values onto real Ortsteil geometry, which readers can easily take for real market figures, even when hatched and labelled. It is not built. It can be revisited when a validated dataset exists, or if the owner asks for it explicitly.

### D-057 · JS budget restated as baseline plus route allowance · Accepted (slice 9, owner)
→ The 150 kB per-route budget couldn't be met: the shared baseline alone is 140.3 kB. ARCH §10 now caps the baseline at 145 kB and gives each route an allowance (content +10 kB, `/explore` +15 kB, form and chart routes +65 kB). The form and chart allowance is set from today's sizes (largest: `/analyze` at 204.1 kB). It freezes the current state rather than proving it lean, and its job is to stop further growth. The `zod/mini` migration (about −17 kB on four routes) remains an option and is not done.

### D-058 · A demo model trained on synthetic data may answer through the contract, under a fixed label · Accepted (ML phase, owner)
→ The owner confirmed this is a demonstration project, not a market product. The only dataset (`kaggle-berlin-5csv`) is synthetic by its author's description (`data/PROVENANCE.md`). The integrity rule "no rent figure unless it came from a real prediction response" is kept, and a second condition is added for this model:
- The response carries `model.training_data.synthetic: true`. The client maps it to `Provenance { kind: "model", trainedOn: "synthetic" }`.
- Every rendering uses the demo band and the words "Demo model, trained on synthetic data. Not a Berlin market estimate."
- Never in `<title>`, meta text, Open Graph, previews, the homepage ledger or neighborhood ledgers, and never beside real figures as a comparison.
- A client that cannot see `synthetic: true` must treat the response as `not_connected`. A missing flag is not read as "observed".
- The label is lifted only when a model trained on observed data (intake `passed`) replaces it, which is a separate decision.
→ **Why not leave prediction disabled:** the pipeline, contract and UI states are the value of the demo, and the label keeps the number from being mistaken for a market figure. **Cost:** the strongest honest claim is "this recovers a synthetic generator with an MAE of about 144 € per month". It says nothing about real Berlin rents.

### D-059 · The client reads the training-data flag, and the live E2E has its own build folder · Accepted (slice 10)
→ `interpretPredictionResponse` returns `ok` with `trainedOn: "synthetic"` only when the answer carries `model.training_data.synthetic: true`. Any other 2xx answer, a missing flag or `false`, becomes `not_connected` with reason `unverified_data`, so a service can't get an unlabelled figure on screen by omission or by claiming observed data (D-058). The panel draws `synthetic` under the hatched band, with the label "Demo model" and the fixed words, and the heading "Demo estimate of the cold rent". `trainedOn: "observed"` stays in the type and the panel can draw it, but the interpreter never produces it: no model qualifies today, and lifting the label for the first one needs its own decision.
→ `NEXT_PUBLIC_PREDICTION_MODE` is inlined at build time, so an E2E against the real service needs a build with `proxy`. `next.config.ts` takes `NEXT_DIST_DIR`, and `playwright.live.config.ts` builds and serves from `.next-live` (git-ignored, ignored by ESLint and `tsc`), so the default build the other projects run against is never overwritten. The default configuration is unchanged: prediction stays `disabled`.

### D-060 · The site is hosted on Netlify, with a head script that removes the host's comment · Accepted (owner)
→ The owner put the site on Netlify (`https://berlinhouse.netlify.app/`, the free plan, `netlify.toml` pins Node 22; no environment variables, so prediction stays `disabled`). Cloudflare was not tried: the OpenNext adapter, the 3 MiB free-plan Worker limit and unconfirmed support for `cacheComponents` made it a gamble.
→ On `*.netlify.app` Netlify adds an HTML comment and a line break to `<head>` after `<meta charset>`, and there is no setting to turn it off. React 19 can't match the extra nodes, throws error #418 on every page and renders it again on the client. Reproduced locally by adding the same comment through a proxy, so the comment alone is the cause (everything else in the HTML is identical).
→ `src/components/layout/host-head-comment.ts` runs in the head before hydration and removes only a comment containing "hosted on Netlify" and the whitespace-only text node after it. Without the comment it does nothing. Covered by a component test and by `tests/e2e/host-comment.spec.ts` (injects the comment into three pages and expects no page error). If Netlify stops adding the comment, the script is dead code and can be removed.
