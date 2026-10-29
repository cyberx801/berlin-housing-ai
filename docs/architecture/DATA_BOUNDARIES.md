# Data Boundaries

Status: v0.1 · 2026-10-29 · Registry of datasets: [`data/PROVENANCE.md`](../../data/PROVENANCE.md)

This document says which data the product may show, how it must be labeled, and how the code keeps the categories apart. **When in doubt, don't show it.**

## 1. Provenance kinds

```ts
// src/types/provenance.ts (planned)
type Provenance =
  | { kind: "official"; sourceId: string; label: string; license: string; retrieved: string }   // ISO date
  | { kind: "research"; sourceId: string; label: string; validation: "pending" | "passed" | "failed" }
  | { kind: "demo"; fixtureId: string; note: string }
  | { kind: "user" }                                   // entered by this user, in this browser
  | { kind: "model"; modelVersion: string; dataReferenceDate: string };
```

| Kind | May render as fact? | Visual (DESIGN_SYSTEM §7) |
|---|---|---|
| `official` | Yes, with source line | Solid ink band, "Official data" |
| `research` | Only once `validation: "passed"` and documented in DECISIONS. Until then it's treated as **not shown**. | Solid band + "Research dataset" + link to its validation report |
| `demo` | **Never** as fact | Hatched band, "Demo data, not Berlin market statistics" |
| `user` | Yes, as *the user's own claim* | "From your entries" |
| `model` | Yes, as an *estimate with uncertainty*, only from a real contract response | "Model estimate", with version and reference date |

Every data-bearing component takes `provenance` as a required prop. The TypeScript types enforce it.

## 2. Dataset registry (summary)

| ID | Dataset | Kind | Status |
|---|---|---|---|
| `alkis-bezirke` | ALKIS Berlin Bezirke (12) | official | **Retrieved 2026-10-29** |
| `alkis-ortsteile` | ALKIS Berlin Ortsteile (97) | official | **Retrieved 2026-10-29** |
| `umweltzone` | Umweltzone Berlin (area inside the S-Bahn ring) | official | **Retrieved 2026-10-29** |
| `kaggle-berlin-5csv` | Kaggle: `rentals`, `secondary_sales`, `new_construction`, `kiez_prices_monthly`, `transit_stations` | research | **Not in repository.** Validation not started. |
| `demo-market-v1` | Synthetic market fixtures for UI development | demo | **Generated in slice 5** (seed `20261029`, D-041) |

Full details (URLs, license text, checksums, CRS, quality notes) are in `data/PROVENANCE.md`.

## 3. Verified facts about the official geodata (2026-10-29)

- 12 Bezirk features. Properties: `gem` (3-digit code, `001`–`012`), `namgem` (name). CRS EPSG:4326.
- 97 Ortsteil features. Properties: `nam` (name), `sch` (12-digit key), `gdf`, `uuid`. CRS EPSG:4326.
  - Per-Bezirk counts, by Bezirk code:

    | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12 |
    |---|---|---|---|---|---|---|---|---|---|---|---|
    | 6 | 2 | 13 | 7 | 9 | 8 | 6 | 5 | 15 | 5 | 10 | 11 |

  - **The last four digits of `sch` are the Ortsteil number `BBOO`** (e.g. `…0102` = Moabit, Bezirk 01). `sch[5..8]` equals the Bezirk `gem`. This was cross-checked by point-in-polygon for all 97, with **0 mismatches**.
  - The `bezeich` property is the ALKIS feature type (`AX_KommunalesGebiet`) for every row. **Do not use it for grouping.**
  - **`gdf` is not a reliable area.** It matches the computed area for single-part features (median ratio 0.996), but not for some multi-part ones: Blankenfelde `gdf` = 139 against ≈ 13.3 km² computed, and Buckow is 3.9× off. **The product computes areas from geometry and ignores `gdf`** (D-010).
- Umweltzone: 1 MultiPolygon, area ≈ 87 km² (planar approximation; the build recomputes it geodesically). The official service abstract: *"Als Umweltzone wird das Gebiet innerhalb des S-Bahn-Ringes bezeichnet."* It is labeled in the UI as **"Umweltzone (area within the S-Bahn ring)"**. It is never presented as railway track geometry.
- The sum of computed Ortsteil areas is ≈ 888 km² (planar), consistent with Berlin's official ≈ 891 km².

## 4. Kaggle dataset intake protocol (`kaggle-berlin-5csv`)

The files go in `data/raw/kaggle/`, which is gitignored until the license allows redistribution. No screen uses them until every step passes and the result is recorded in DECISIONS.

1. **Provenance:** the Kaggle URL, author, license, version or date, the stated original source and collection method. If no original source is stated, it is classed as **unverified origin**.
2. **Schema:** columns, types, null rates and row counts per file, written to `docs/data/kaggle-profile.md` (generated).
3. **Join keys:** which files actually share keys (Ortsteil/Kiez names, IDs, dates). The joins are *assumed impossible* until shown otherwise. Name matching is tested against the 97 ALKIS Ortsteile, and unmatched names are reported, not guessed.
4. **Plausibility against independent references:**
   - per-district €/m² ranges against published official or semi-official figures (Berliner Mietspiegel, IBB Wohnungsmarktbericht), with citations
   - time coverage
   - duplicate listings
5. **Synthetic-data signals:** overly smooth or uniform distributions, repeated decimal patterns, impossible combinations (e.g. 1 room at 180 m²), implausible spatial patterns, or round-number excess. If the dataset looks synthetic, it may only be used as **demo**, under the demo label.
6. **Decision:** `passed` (it becomes `research` with documented caveats), `demo-only`, or `rejected`.

## 5. Demo fixture rules

- Fixtures live in `src/lib/fixtures/demo/` and nowhere else. Every file carries a top-level `"_provenance": {"kind":"demo", ...}`, and the folder has a README.
- They are generated by `scripts/build-demo-fixtures.mjs` with a fixed seed, so they are deterministic and reviewable in diffs. They are never hand-typed to look real.
- Values are *plausible in shape* so the UI can be developed (EUR, €/m² in a believable range, monthly series). Plausibility is a design-testing aid, not a claim.
- Only `src/lib/data/market/demo-source.ts` imports them. ESLint `no-restricted-imports` and a Vitest boundary test both enforce this.
- Every rendering of demo data carries the demo band, and the label is also drawn inside the SVG.
- Demo values never appear in: page `<title>`/meta descriptions, Open Graph images, marketing copy, the homepage ledger, or neighborhood fact ledgers.
- The real-data swap: a `MarketDataSource` implementation backed by a validated dataset replaces `demo-source` in `src/lib/data/market/index.ts`. Its `provenance` changes, and the UI labels follow automatically.

```ts
// src/lib/data/market/source.ts (types in src/types/market.ts; scope per module: D-040)
export interface MarketDataSource {
  readonly provenance: Provenance;
  readonly coverage: MarketCoverage;               // { firstYear, lastYear, types }
  // Periods are whole years, both ends included. `bezirke: []` means all of Berlin.
  rentTrend(q: { bezirke: BezirkCode[]; from: number; to: number; type: MarketTypeFilter }): Promise<TrendResult>;
  districtComparison(q: { from: number; to: number; type: MarketTypeFilter }): Promise<DistrictValue[]>;
  priceDistribution(q: { bezirke: BezirkCode[]; from: number; to: number; type: MarketTypeFilter }): Promise<PriceHistogram>;
  propertyTypeComparison(q: { bezirke: BezirkCode[]; from: number; to: number }): Promise<TypeValue[]>;
}
```

The dashboard reaches the source through `GET /api/market/*` (one route per method, returning `{ provenance, data }`) and, for the default view, at build time (D-022). Client code never imports `src/lib/data/market`.

## 6. Geo derivation rules (implemented in `scripts/build-geo.mjs`)

| Derived field | Method | Notes |
|---|---|---|
| `code` | `sch.slice(-4)` → `"0102"` | Official Ortsteil number |
| `bezirkCode` | `sch.slice(6, 8)` (as `"01"`…`"12"`) | Asserted against point-in-polygon on a guaranteed interior point |
| `areaKm2` | Geodesic area of the **raw** geometry (mapshaper `this.area` on lat/long data), rounded to 0.01 | Never `gdf` |
| `ringShare` | area(Ortsteil ∩ Umweltzone) / area(Ortsteil), from raw geometry | |
| `ringStatus` | `inside` if share ≥ 0.95, `outside` if share ≤ 0.05, else `partly` | The thresholds absorb boundary slivers. The method is shown on `/methodology#ring`, and the profile shows the share. |
| `neighbors` | Topological adjacency (shared arcs) on the **unsimplified** topology. Point contacts are excluded. | Symmetry asserted |
| `slug` | Lowercase. `ä→ae`, `ö→oe`, `ü→ue`, `ß→ss`. Other diacritics stripped via NFD. Non-alphanumerics → `-`, collapsed and trimmed. | Tests: `Köpenick→koepenick`, `Weißensee→weissensee`, `Schöneberg→schoeneberg`, `Märkisches Viertel→maerkisches-viertel`, `Alt-Hohenschönhausen→alt-hohenschoenhausen`. Uniqueness asserted. |
| `bezirkSlug` | Same rule (`Tempelhof-Schöneberg→tempelhof-schoeneberg`) | Separate namespace from Ortsteil slugs (both "Mitte" names exist) |
| Simplification | mapshaper Visvalingam (weighted), **topology-preserving** (shared arcs), two levels: plates (heavy) and map (moderate) | Per-feature simplification is forbidden because it opens slivers between neighbors. |

## 7. Content rules for neighborhoods

- Facts come only from §6 derivations. Later, other `official` sources may be added once they are registered (e.g. population from Amt für Statistik Berlin-Brandenburg, after license review).
- No ratings, scores, safety or "vibe" indices, or rankings of neighborhoods.
- Character or description text is either (a) sourced, with each claim linked to a citable source, or (b) absent, and the module then shows "Not written yet". There is no unlabeled sample prose about real places (D-019).

## 8. Candidate sources (not yet verified; listed only to plan)

| Candidate | Would provide | Check before use |
|---|---|---|
| VBB GTFS (Verkehrsverbund Berlin-Brandenburg) | Station locations, so transit distance can be computed rather than self-reported | License, attribution, update cadence, size |
| Berliner Mietspiegel (Senatsverwaltung) | Official reference ranges for the methodology context | Terms of reuse, edition year, what it measures (not asking rents) |
| Amt für Statistik Berlin-Brandenburg | Population and housing stock per Ortsteil or LOR | License, key alignment (LOR vs Ortsteil) |
| OpenFreeMap | Optional street basemap | Terms, attribution (OSM ODbL), uptime expectations |
