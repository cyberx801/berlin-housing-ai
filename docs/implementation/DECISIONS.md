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
