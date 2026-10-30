# Dataset Provenance Registry

Every dataset in this repository has an entry here before any code reads it. Rules: [docs/architecture/DATA_BOUNDARIES.md](../docs/architecture/DATA_BOUNDARIES.md).

---

## alkis-bezirke

| | |
|---|---|
| File | `raw/geo/alkis_bezirke.geojson` |
| Publisher | Land Berlin, Geoportal Berlin (GDI Berlin). Derived from the ALKIS cadastre. |
| Service | WFS `https://gdi.berlin.de/services/wfs/alkis_bezirke` |
| Request | `REQUEST=GetFeature&SERVICE=WFS&VERSION=2.0.0&TYPENAMES=alkis_bezirke:bezirksgrenzen&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326` |
| License | Datenlizenz Deutschland – Zero – Version 2.0 (`dl-de/zero-2-0`, https://www.govdata.de/dl-de/zero-2-0), as stated in the service capabilities (`Fees`). Access constraints: none. |
| Retrieved | 2026-10-29 |
| CRS | EPSG:4326 (`urn:ogc:def:crs:EPSG::4326`), coordinates lon/lat |
| Features | 12 MultiPolygons. Properties: `name`, `gem`, `namgem`, `namlan`, `lan` |
| SHA-256 | `d29e8dca3693c8f011aaecdb8f214bc3edf58592a1aea996e2037128536e9122` |
| Attribution shown | "Geometry: ALKIS Berlin (Geoportal Berlin), dl-de/zero-2.0". Attribution isn't required by the license, but the product shows it. |

## alkis-ortsteile

| | |
|---|---|
| File | `raw/geo/alkis_ortsteile.geojson` |
| Publisher | Land Berlin, Geoportal Berlin (GDI Berlin), ALKIS |
| Service | WFS `https://gdi.berlin.de/services/wfs/alkis_ortsteile` |
| Request | `REQUEST=GetFeature&SERVICE=WFS&VERSION=2.0.0&TYPENAMES=alkis_ortsteile:ortsteile&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326` |
| License | dl-de/zero-2.0, per this service's own GetCapabilities `Fees` element (verified 2026-10-29). Access constraints: none. |
| Retrieved | 2026-10-29 |
| CRS | EPSG:4326 |
| Features | 97 MultiPolygons. Properties: `uuid`, `sch`, `nam`, `gdf`, `bezeich` |
| SHA-256 | `d0c077ffdf7da6dcc272123bcb66df11e8bcd9fe0f4dc2da6325c2fb61b1ed2d` |
| Quality notes | `gdf` is unreliable for multi-part features (Blankenfelde 139 vs ≈13.3 km² computed), so areas are computed from geometry. `bezeich` is the feature type, not the Bezirk. The Bezirk comes from `sch`. |

## umweltzone

| | |
|---|---|
| File | `raw/geo/umweltzone.geojson` |
| Publisher | Land Berlin, Geoportal Berlin |
| Service | WFS `https://gdi.berlin.de/services/wfs/umweltzone` (type `umweltzone:umweltzone`) |
| Request | `REQUEST=GetFeature&SERVICE=WFS&VERSION=2.0.0&TYPENAMES=umweltzone:umweltzone&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326` |
| License | dl-de/zero-2.0 (capabilities `Fees`, verified 2026-10-29) |
| Description (official abstract) | "Als Umweltzone wird das Gebiet innerhalb des S-Bahn-Ringes bezeichnet, in dem nur Fahrzeuge fahren dürfen, die bestimmte Abgasstandards einhalten. Die Umweltzone gilt ab 1. Januar 2008." |
| Retrieved | 2026-10-29 |
| CRS | EPSG:4326 |
| Features | 1 MultiPolygon. Properties: `schluessel: "UZONE"`, `nam: "Umweltzone"` |
| SHA-256 | `f9f059264096737e95353f4d01cf5a93119955d44ff5ecf65993cc70aa0e78c4` |
| Use | Defines "inside / partly / outside the Ring". Labeled "Umweltzone (area within the S-Bahn ring)". It is not track geometry. |

## zensus-2022-rent-grid

| | |
|---|---|
| File | `raw/zensus/Zensus2022_Durchschn_Nettokaltmiete_Anzahl_der_Wohnungen_100m-Gitter.csv` (73 MB, git-ignored; the build output is `src/lib/data/zensus/generated/zensus-rent.json`, which is committed) |
| Publisher | Statistische Ämter des Bundes und der Länder, Zensus 2022 (Statistisches Bundesamt) |
| Service | https://www.destatis.de/zensus2022 |
| Download | `https://www.destatis.de/static/DE/zensus/gitterdaten/Durchschnittliche_Nettokaltmiete_und_Anzahl_der_Wohnungen.zip` (11 MB; also holds the 1 km and 10 km grids and the dataset description) |
| License | **Datenlizenz Deutschland – Namensnennung – Version 2.0** (`dl-de/by-2.0`, http://www.govdata.de/dl-de/by-2-0). Stated in the dataset description (`Datensatzbeschreibung_Durchschn_Nettokaltmiete_und_Anzahl_der_Wohnungen.xlsx`, section "Zeichenerklärung"), verified 2026-10-30. The results pages of zensus2022.de say only "free use with attribution (OpenData)" and do not name the license. |
| Attribution | "Ergebnisse des Zensus 2022, Statistische Ämter des Bundes und der Länder". The site shows it on every figure and states that it aggregated the cells (the license requires a note on changes). |
| Retrieved | 2026-10-30 |
| Reference date | 2022-05-15 (Zensus Stichtag) |
| CRS | ETRS89-LAEA Europe (EPSG:3035), cell midpoints in `x_mp_100m`, `y_mp_100m` |
| Columns | `GITTER_ID_100m`, `x_mp_100m`, `y_mp_100m`, `durchschnMieteQM` (comma decimal), `AnzahlWohnungen`, `werterlaeuternde_Zeichen` (`KLAMMERN` = statistically uncertain) |
| Rows | 1,287,342 cells for Germany. 38,975 fall in a box around Berlin, 28,463 of them inside an Ortsteil (the rest are Brandenburg). |
| Definition | Ratio of the sum of the per-m² rents to the number of flats, for rented flats in residential buildings (no dormitories). Flats let rent-free are left out. Cells without people or flats are not in the file, which can also come from the confidentiality method (cell key: values are perturbed, sums deviate). |
| SHA-256 | `824a0e4992c808086b394cb82bacdc4732768ebc69ba25da610151c8619c11eb` (the 100 m file) |
| Intake (DATA_BOUNDARIES §9) | `passed` as an official source: license named in the dataset description, stated definition and reference date, Berlin weighted mean 7.66 €/m² against the published 7.67 €/m², plausible order across Ortsteile (lowest Marzahn, highest Grunewald and Dahlem). Decision D-062. |
| Use | The Ortsteil profile module "What did tenants in X pay in 2022?" only. Existing contracts, not asking rents. It is not mixed with the demo market figures or the demo model. |

## kaggle-berlin-5csv — SYNTHETIC (intake finished 2026-10-30), not in the repository

| | |
|---|---|
| URL | https://www.kaggle.com/datasets/sergionefedov/berlin-real-estate-sales-and-rentals-2020-2026 |
| Author, license | Sergey Nefedov · **Apache 2.0** (Kaggle page, last modified 2026-05-23) |
| Origin, in the author's words | Ortsteil coordinates, U/S/Stadtbahn stations and the ECB rate timeline are real anchors, with ImmobilienScout24-anchored base prices. "Listing-level apartment characteristics are generated from the hedonic model." The listings are **not observed**. |
| Files (rows) | `rentals.csv` 30,000 · `secondary_sales.csv` 50,000 · `new_construction.csv` 10,000 · `kiez_prices_monthly.csv` 6,232 · `transit_stations.csv` 135 |
| SHA-256 | `rentals` `78dd98d5104b19f6db809692e53a7f8ceaf48ae2c2e0281a41917150d3709043` · `secondary_sales` `95a677ba1a7e81254f782e2cf94b7fc7532e6f1fc35e23724e873b211362ce0c` · `new_construction` `8f0d57070ad277cdfd504cea759ef85615e6825440c9f87ce5f3c49cd73bdeb2` · `kiez_prices_monthly` `382d92c96928b91f3b6f5053189597a40b1ebaf64a890fee5b766e0fe552c5e8` · `transit_stations` `da1ca0af40d0d376a175a821e60c42095aa8bbaa27d5a18879fee0e3ad5bc228` |
| Coverage | 2020-01-01 to 2026-04-29, 82 Ortsteil names (73 identical to ALKIS, 7 as "X (Ort)" for the Ortsteil that shares its Bezirk's name, 2 ambiguous: "Hohenschönhausen", "Treptow"), 15 ALKIS Ortsteile absent |
| Our own evidence, consistent with the author's statement | no missing values in any file · rents show no round-number heaping (1.1 % multiples of 100) · the market level is a half-yearly step function (calendar year explains 94.8 % of month-level variance) · `transit_distance_min` is the walk to a *named* station that is the nearest one in only 12 % of rows (56.5 % of values exceed 60 min) |
| Leaking columns | `warmmiete_eur_monthly`, `warmmiete_eur_monthly_usd`, `rent_per_m2_kalt_eur` are exact functions of the target |
| **Intake decision** | **`demo-only`** (DATA_BOUNDARIES §4 step 5). It never becomes a `research` source, so no figure derived from it is presented as Berlin market data. A model trained on it may be served only with the synthetic-model label (D-058). |
| Where it lives | Not in the repository. The ML work runs in Colab, which downloads it with `kagglehub`. |

## demo-market-v1 — DEMO, not a dataset

| | |
|---|---|
| Kind | `demo` (synthetic). **Not Berlin market statistics.** |
| File | `src/lib/fixtures/demo/market-v1.json` (about 111 kB). Generated, never hand-edited. |
| Generator | `scripts/build-demo-fixtures.mjs` → `scripts/lib/demo-market.mjs`, seed `20261029`, version 1 |
| Method | Simulated listings per month (2020–2025), stored only as monthly medians and counts plus yearly 1 € histograms. Bezirk levels, volumes, type multipliers and the four empty Bezirk × type combinations are random draws from the seed, with no real-world ordering. Details: `src/lib/fixtures/demo/README.md`. |
| Check | `npm run fixtures:build -- --check`. `tests/unit/demo-market.test.ts` rebuilds it and compares. |
| Use | `/market` only, through `src/lib/data/market/demo-source.ts`. Replaced by a validated source in `src/lib/data/market/index.ts` (DATA_BOUNDARIES §5). |
