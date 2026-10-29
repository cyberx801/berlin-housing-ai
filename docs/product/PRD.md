# Berlin Housing AI — Product Requirements

| | |
|---|---|
| Status | Draft v0.1 — source of truth for Phase 4 |
| Last updated | 2026-10-29 |
| Related | [USER_FLOWS](USER_FLOWS.md) · [DESIGN_DIRECTION](../design/DESIGN_DIRECTION.md) · [FRONTEND_ARCHITECTURE](../architecture/FRONTEND_ARCHITECTURE.md) · [PREDICTION_API](../contracts/PREDICTION_API.md) · [DATA_BOUNDARIES](../architecture/DATA_BOUNDARIES.md) |

## 1. Product question

> **What does this property cost, how does it compare with its surroundings, and what can the data actually tell us?**

Berlin Housing AI is a research tool for Berlin housing. People use it to read a flat against its city. They can explore the 12 Bezirke and 97 Ortsteile, compare listings they've found, and prepare a structured property description for a rent model. A separate ML team is building that model.

The product earns trust by **saying what it knows, what it is only demonstrating, and what it can't yet do**. That rule outranks visual polish.

## 2. Audiences and their jobs

| Audience | Primary job | What they need from us |
|---|---|---|
| Students and international newcomers | "I found a listing. Is the asking rent normal for that area?" | Plain-language orientation to Bezirk and Ortsteil. A fast way to describe a flat. Honest about what we can't answer yet. |
| Renters evaluating an offer | "Compare this offer with the two others I'm considering." | Side-by-side comparison, €/m² calculated from their own entries, and missing data flagged. |
| People comparing neighborhoods | "Where is Moabit, what borders it, is it inside the Ring?" | A map, a searchable directory, and verified geographic facts. |
| Researchers and enthusiasts | "How do districts compare, and where does the data come from?" | Dashboards with methodology, provenance and table views. Demo data must be clearly marked. |
| Owners and investors | "How does the market look by district and property type?" | The same dashboards, without overstated precision. |

## 3. Capability truth table (what exists in this phase)

Every screen derives its labels from this table. See [DATA_BOUNDARIES §1](../architecture/DATA_BOUNDARIES.md) for the provenance kinds.

| Capability | State | Backing |
|---|---|---|
| Bezirk and Ortsteil geometry, names, areas, adjacency, Ring status | **Live — official data** | ALKIS Berlin and Umweltzone WFS, dl-de/zero-2.0, retrieved 2026-10-29 |
| Market figures (rent trends, €/m², distributions, property types) | **Demo** | Synthetic fixtures, isolated and labeled. Real source pending validation. |
| Kaggle research dataset (5 CSVs) | **Not available** | Files aren't in the repo yet. Intake protocol in DATA_BOUNDARIES §4. |
| Rent prediction | **Not connected** | Draft contract only (`POST /api/v1/predictions/rent`). The UI shows a not-connected state. |
| Transit accessibility | **Not connected** | Candidate source: VBB GTFS or `transit_stations.csv` after validation |
| User-entered listing data (compare) | **Live — user data** | Stored only in the user's browser (localStorage) |
| Neighborhood character text | **Pending** | Only sourced statements, or none. No invented prose. |

## 4. Scope

### In scope (this phase)
- Routes `/`, `/analyze`, `/explore`, `/market`, `/neighborhoods`, `/neighborhoods/[slug]`, `/compare`, `/methodology`, plus `not-found` and error states.
- A design system and component library built for this product.
- A geodata build pipeline from the official raw files to derived, simplified, typed artifacts.
- A typed prediction integration boundary: service, transports, Zod schemas and a draft contract. It is **disabled** by default.
- A typed market-data adapter boundary with a demo implementation.
- Tests: unit, component, E2E journeys, axe accessibility scans, and screenshots at responsive viewports.
- Project-local Claude skills: `design-system`, `frontend-quality`, `accessibility-review`.

### Out of scope (this phase)
- Training, serving or simulating any ML model. No pricing formulas of any kind.
- Paid APIs, LLM calls, billable cloud services, deployment, and domains.
- User accounts, authentication, server-side persistence, analytics and tracking.
- Scraping listings or ingesting third-party listing data.
- Geocoding addresses. Address text is kept as free text, and `lat/lon` stay `null`. See DECISIONS D-017.
- A German UI translation. The UI is English with official German place names. The architecture leaves room for i18n.

## 5. Functional requirements and acceptance criteria

Acceptance criteria are written so a Playwright test or a reviewer can check them directly.

### A. Landing — `/`
- **A1** The hero shows the product statement and the **Ring Plate**: all 97 Ortsteile and the Umweltzone (S-Bahn ring) boundary, rendered from official geometry as server-side SVG.
- **A2** Hovering or focusing an Ortsteil on the plate reveals its name, Bezirk and Ring status. Every Ortsteil is reachable by keyboard: either the plate's own focus order or the linked list.
- **A3** A compact analysis entry (Bezirk, living area, rooms) navigates to `/analyze` with those values pre-filled via URL parameters. It shows the same validation messages as `/analyze`.
- **A4** The tools index lists each tool with the question it answers and its data state (Live / Demo / Not connected). It is not a card grid.
- **A5** Neighborhood discovery shows 12 Bezirk silhouettes from real geometry with real Ortsteil counts. Each links to `/neighborhoods?bezirk=<slug>`.
- **A6** The limitations section states the capability truth table (§3) in plain language.
- **A7** The page is usable at 360 px wide with no horizontal scroll. Its LCP element is text or the inline SVG, not a web font or image.

### B. Property analysis — `/analyze`
- **B1** The form has five groups: Location, The flat, Building, Features, Surroundings. Each group has a heading, a completion count, and required/optional marking in text, not color alone.
- **B2** Required fields are Bezirk, property type, living area and rooms. All other fields are optional, and every categorical optional field offers an explicit **"Not sure"** value. Booleans are tri-state; see D-015.
- **B3** The Ortsteil options are limited to the selected Bezirk. Changing the Bezirk clears an Ortsteil that no longer fits, and the change is announced.
- **B4** Validation rules come from the shared Zod schema, for example area 10–500 m², rooms 1–10 in steps of 0.5, and floor ≤ total floors. Each error names the field, the rule and the fix. On submit, focus moves to the first invalid field, and an error summary links to each one.
- **B5** Submitting a valid form calls `PropertyAnalysisService.estimateRent()`. With the default disabled transport, the result is a typed `not_connected` outcome. The UI then shows:
  - the **"Prediction engine not connected"** state
  - a summary of the inputs
  - a disclosure with the exact request payload that would be sent
  - actions: *Add to comparison* and *Open Ortsteil profile*

  **No number that resembles a rent estimate is shown.**
- **B6** The form state survives a reload within the session (sessionStorage) and can be reset with a confirmation step.
- **B7** The whole form is completable by keyboard alone, and the result is announced through a polite live region.

### C. Market explorer — `/explore`
- **C1** A MapLibre map renders Bezirk and Ortsteil polygons from the derived official geometry. By default there is no third-party basemap; see D-004.
- **C2** Selecting an Ortsteil by map click, list, or search opens an info panel. The panel shows name, Bezirk, area in km², Ring status, adjacent Ortsteile, and links to the profile and to Analyze (pre-filled).
- **C3** Filters (Bezirk, Ring status, name search) and the current selection live in the URL (`?bezirk=&ring=&q=&o=`), so links can be shared.
- **C4** A keyboard-navigable list of Ortsteile is always in sync with the map. The map is never the only way to reach anything.
- **C5** If WebGL is unavailable, the page falls back to the SVG plate and the list, and says so.
- **C6** There is no market heatmap in this phase. A choropleth of demo values is allowed only behind an explicit "Show demo layer" toggle, with hatched labeling. Default: off.

### D. Market intelligence — `/market`
- **D1** The dashboard has four modules: rent trend over time, district comparison (€/m²), price distribution, and property-type comparison. Each module answers a stated question.
- **D2** Filters (Bezirke ≤ 4 for line comparison, period, property type) sit in one row or the rail, persist in the URL, and update every module.
- **D3** Every module carries a provenance band. While the data is demo, the band is hatched and labeled **"Demo data, not Berlin market statistics"**, and the label is also drawn inside the SVG so screenshots keep it.
- **D4** Every chart has a hover/focus tooltip, a legend when it has 2 or more series, and a **table view** toggle.
- **D5** The methodology notes link to `/methodology#market-data`.

### E. Neighborhoods — `/neighborhoods`, `/neighborhoods/[slug]`
- **E1** The directory lists all 97 Ortsteile and can be filtered by Bezirk and Ring status and searched by name. Filters live in the URL.
- **E2** All 97 profile pages are statically generated. Slugs follow the rule in DATA_BOUNDARIES §6.
- **E3** Profiles show only verified geographic facts: Bezirk, area, Ring status with the method stated, adjacent Ortsteile, and a locator map.
  - Market, transit and character modules render their honest state: Demo, Not connected, or Pending.
  - No ratings, safety indices or unsourced claims.
- **E4** A profile links to Analyze pre-filled with its Bezirk and Ortsteil, and to Explore centered on it.

### F. Compare — `/compare`
- **F1** Up to 3 properties. Each can be entered manually, added from `/analyze`, replaced, or removed. Clearing all requires confirmation.
- **F2** Rows: location, type, area, rooms, floor, building attributes, features, asking cold rent (user-entered), €/m² (calculated from the user's own entries and labeled so), and predicted rent (always "Model not connected").
- **F3** Missing values are marked in text, so the user can see which fields to fill in.
- **F4** The state persists in localStorage under a versioned key and is validated with Zod on read. Corrupt data is dropped, and the user is told.
- **F5** At 360 px wide the comparison stays readable, with no horizontal page scroll.

### G. Methodology — `/methodology`
- **G1** It explains, with anchors:
  - what works today
  - what is in development
  - the data sources and licenses
  - market data vs. predictions
  - why estimates carry uncertainty
  - known limitations
  - the geodata derivations (area, Ring status, adjacency)
- **G2** The contents mirror §3 of this PRD. It never presents the model as ready for production.

## 6. Product integrity rules (non-negotiable)

1. No predicted, estimated or "fair" rent value is rendered anywhere until a real model response arrives through the contract.
2. No numeric market claim appears in marketing copy.
3. Every module that shows data shows its provenance.
4. Demo fixtures never sit behind a real-data label and are never imported outside the demo adapter (enforced by lint and a test).
5. Every module that would show a missing capability states the reason. Nothing is silently hidden in a way that implies completeness.
6. No ratings, scores or indices about neighborhoods unless sourced and documented.

## 7. Non-functional requirements

- **Accessibility:** WCAG 2.2 AA as far as practicable. axe reports 0 serious or critical violations on every route. Full keyboard operation. Reduced-motion support. Visible focus that meets 2.4.11/2.4.13 intent.
- **Performance:**
  - LCP ≤ 2.5 s on a mid-range mobile profile (Lighthouse).
  - Route JS ≤ 150 kB gzip, except `/explore`, where MapLibre is lazy-loaded after first paint.
  - Geometry payload sent to the client ≤ 300 kB gzip.
- **Browsers:** the last 2 versions of Chrome, Edge, Firefox and Safari, and iOS Safari 17+.
- **Privacy:** no cookies, analytics or third-party requests by default. User data stays in browser storage.
- **Runs locally:** `npm install && npm run dev` with no API keys.

## 8. Phase exit criteria
These mirror the brief's §10:
- All routes render.
- Typecheck, lint, unit, component and E2E tests pass.
- The production build succeeds.
- An accessibility review is documented.
- Screenshots are reviewed at 375, 768 and 1440 px.
- No invented predictions anywhere.
- The prediction service can be switched on by configuration alone.
- The setup is documented in the README.

## 9. Open questions
| # | Question | Owner | Blocking? |
|---|---|---|---|
| Q1 | Kaggle dataset URL, license and the files themselves | User / data | Blocks real market data, not the UI |
| Q2 | ML feature schema: names and enum values | ML team | Blocks contract v1 freeze, not the UI |
| Q3 | Will the FastAPI service be public (CORS) or need a key? | ML team | Decides the transport mode (PREDICTION_API §8) |
| Q4 | Is a German UI wanted in a later phase? | Product | No |
| Q5 | Is an optional OpenFreeMap street basemap acceptable after its terms are reviewed? | Product | No (default is none) |
