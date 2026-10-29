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

## kaggle-berlin-5csv — NOT PRESENT

| | |
|---|---|
| Expected files | `raw/kaggle/rentals.csv`, `secondary_sales.csv`, `new_construction.csv`, `kiez_prices_monthly.csv`, `transit_stations.csv` |
| Status | Not in repository as of 2026-10-29. Kaggle URL, license and author unknown. |
| Next step | Owner adds the files and the Kaggle URL, then the intake protocol in DATA_BOUNDARIES §4 runs. |
