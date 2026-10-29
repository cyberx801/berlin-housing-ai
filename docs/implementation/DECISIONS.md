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

### D-022 · `/market` data loading model · Open (resolve in slice 5)
ARCH §3 renders `/market` statically, passes the whole (small) demo dataset as props and filters it client-side. DATA_BOUNDARIES §5 defines `MarketDataSource` as async and per-query. Those fit the demo fixtures, but a real backend source will not suit the "pass everything as props" model.
→ In slice 5, choose either (a) server components that read `searchParams` (dynamic rendering, per-query calls), or (b) a client fetch through a route handler. Keep the `MarketDataSource` interface either way, so swapping the source doesn't touch the UI.
→ Note (slice 1): the root layout sets `ensureStatic = "navigation"` (D-027), so option (a) would mean relaxing that for `/market` only. Option (b) keeps the route static.

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
→ The demo choropleth toggle (PRD C6) waits for the slice 5 fixtures.

### D-039 · `/explore` layout: one DOM, two arrangements · Accepted
→ From `lg`, the list and filters form the left rail (3 of 12 columns), which scrolls on its own. The details panel docks over the map's right edge, and camera fits and label placement leave that strip free. The whole explorer is sized to fit under the page title, so the attribution is visible without scrolling.
→ Below `lg`, the map takes the top 55 % of the viewport above a tablist (List / Details) and a sheet that scrolls on its own, as USER_FLOWS Flow 3 asks. The sheet is a region, not a modal. Selecting switches to Details, and focus follows only if it was in the list that just hid. Short viewports (under 34rem, such as landscape phones or page zoom) drop the split and let the page scroll. Tab roles are set only below `lg`.
