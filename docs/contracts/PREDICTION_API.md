# Rent Prediction API — Contract v1

> **Status: DRAFT 2.** A first model exists (ML phase, 2026-10-30) and was built against this contract. It is a **demo model trained on synthetic data** (D-058), so the frontend shows its answers only under the demo label. The request shape is unchanged. Draft 2 adds response fields (§3.1) and records how the model reads each request field (§2.1). Prediction stays **disabled** in the frontend until the service is wired up.

| | |
|---|---|
| Version | `1.0-draft.2` · 2026-10-30 (draft.1: 2026-10-29) |
| Producer | Future Python/FastAPI service (ML team) |
| Consumer | Berlin Housing AI frontend (`src/lib/api/prediction`, `src/lib/contracts/rent-prediction.v1.ts`) |
| Change control | Breaking changes → `/api/v2`. Additive changes → minor `api_version` bump. This doc and the Zod schema change in the same PR. |

---

## 1. Endpoints

| Method | Path | Purpose | Required in v1? |
|---|---|---|---|
| `POST` | `/api/v1/predictions/rent` | Estimate the monthly **cold rent** (Nettokaltmiete) for one property | Yes |
| `GET` | `/api/v1/health` | Liveness and readiness, plus the model currently loaded | Yes |
| `GET` | `/api/v1/models/rent/current` | Model card metadata: version, training period, data reference date, metrics with their evaluation set | Recommended |
| `GET` | `/api/v1/schema/rent` | Machine-readable enums and bounds the model accepts, so the UI options can come from the backend instead of being hard-coded | Recommended |

Every request and response is `application/json; charset=utf-8`. The client sends an `X-Request-ID` (UUID v4), and the server echoes it as `request_id`.

## 2. Request — `POST /api/v1/predictions/rent`

```json
{
  "bezirk": "Mitte",
  "ortsteil": "Moabit",
  "ortsteil_code": "0102",
  "property_type": "apartment",
  "rooms": 2.5,
  "area_m2": 65,
  "floor": 2,
  "total_floors": 5,
  "building_era": "unknown",
  "energy_class": "unknown",
  "condition": "unknown",
  "has_lift": null,
  "has_balcony": true,
  "furnishing": "unfurnished",
  "transit_distance_min": null,
  "lat": null,
  "lon": null
}
```

| Field | Type | Required | Constraints (proposed) | Notes |
|---|---|---|---|---|
| `bezirk` | string (enum, 12) | **yes** | The official ALKIS name exactly, e.g. `"Neukölln"`, `"Friedrichshain-Kreuzberg"` | The server normalizes Unicode (NFC). |
| `ortsteil` | string \| null | no | Official ALKIS Ortsteil name, and it must belong to `bezirk` | `null` = not provided |
| `ortsteil_code` | string \| null | no | 4 digits `BBOO` from the ALKIS `sch` key (e.g. `"0102"`) | Unambiguous join key, recommended for the ML pipeline |
| `property_type` | enum | **yes** | `apartment` \| `maisonette` \| `penthouse` \| `loft` \| `house` \| `other` | **Pending ML.** |
| `rooms` | number | **yes** | 1–10, multiple of 0.5 | German listings count half rooms ("2,5 Zimmer"). |
| `area_m2` | number | **yes** | 10–500 | Living area (Wohnfläche) |
| `floor` | integer \| null | no | −1 to 60. `-1` = basement/souterrain, `0` = ground floor | Must be ≤ `total_floors` when both are given |
| `total_floors` | integer \| null | no | 1–60 | |
| `building_era` | enum | no (default `unknown`) | `pre_1919` \| `1919_1949` \| `1950_1972` \| `1973_1990` \| `1991_2009` \| `2010_plus` \| `unknown` | **Pending ML.** These bands are a proposal and may be aligned with the Berliner Mietspiegel bands if the ML team uses them. |
| `energy_class` | enum | no (default `unknown`) | `A_plus` \| `A` \| `B` \| `C` \| `D` \| `E` \| `F` \| `G` \| `H` \| `unknown` | German Energieausweis classes A+ to H |
| `condition` | enum | no (default `unknown`) | `first_occupancy` \| `renovated` \| `well_kept` \| `needs_renovation` \| `unknown` | **Pending ML.** |
| `has_lift` | boolean \| null | no | `null` = unknown | Tri-state (D-015) |
| `has_balcony` | boolean \| null | no | `null` = unknown | Includes loggia/terrace? **Pending ML.** |
| `furnishing` | enum | no (default `unknown`) | `unfurnished` \| `partly_furnished` \| `furnished` \| `unknown` | Replaces the illustrative boolean `furnished` from the brief, because furnished flats are priced differently and partial furnishing is common. **Pending ML.** |
| `transit_distance_min` | integer \| null | no | 0–60, walking minutes to the nearest rail/U/S/tram stop | User-reported in this phase |
| `lat`, `lon` | number \| null | no | Both or neither. lat 52.33–52.68, lon 13.08–13.77 (Berlin bounding box) | Always `null` in this phase: no geocoding (D-017) |

Unknown fields are **rejected** (`VALIDATION_ERROR`). That keeps silent schema drift from going unnoticed.

### 2.1 How the first model reads each field (draft.2)

The training data has coarser categories than the request. The service does the mapping, so the client keeps sending the contract values. Fields the model cannot use are accepted, listed under `inputs.ignored`, and have no effect.

| Request field | In the model | Handling |
|---|---|---|
| `bezirk`, `ortsteil`, `ortsteil_code` | Ortsteil level (82 names) | Code or name resolves the Ortsteil. Missing, or one of the 15 ALKIS Ortsteile absent from the data → the Bezirk average, with `LOW_SUPPORT_REGION` (unknown or absent). Alt- and Neu-Hohenschönhausen share one merged level. |
| `property_type` | **not used** | In the data it is only a room-count label. Required by the schema, ignored. |
| `rooms` | whole rooms 1–5 | Half rooms are rounded half up, values above 5 are capped, with `OUT_OF_DISTRIBUTION` |
| `area_m2` | yes | Outside 20–302 m² → `OUT_OF_DISTRIBUTION` |
| `floor`, `total_floors` | 0–8 and 3–8 | Basement counts as ground floor, higher values are capped, with a warning |
| `building_era` | 4 bands | `pre_1919` and `1919_1949` → pre-1949 · `1950_1972` and `1973_1990` → 1949–1990 · `1991_2009` → 1990–2010 · `2010_plus` → post-2010 |
| `energy_class` | 9 classes | Identical |
| `condition` | 5 German states | `renovated` and `needs_renovation` map. `well_kept` and `first_occupancy` have no counterpart → treated as unknown, with `INPUT_INCONSISTENT` |
| `furnishing` | yes/no | `partly_furnished` → unknown |
| `has_lift`, `has_balcony` | yes/no | `null` → unknown |
| `transit_distance_min` | **not used** | The training field measures the walk to a named station that is rarely the nearest one, so it does not mean this field |
| `lat`, `lon` | **not used** | Always null in this phase. The model derives distance to the centre from the Ortsteil. |

**Unknown inputs** are not filled with a single guess. The service averages the model over the training distribution of the missing field (the Bezirk's Ortsteile, or the era, energy class, etc.), treating missing fields as independent. The interval widens accordingly. Each such field is listed in `inputs.missing` and `inputs.imputed` with the strategy `train_distribution_marginalised`.

**Compatibility rule.** Strict rejection and additive minor versions can coexist only if:
1. a new optional request field always ships **server-first**: the server accepts it before any client sends it; and
2. the client sends only the fields of the `api_version` the server advertises, through `GET /api/v1/health` (`api_version`) or `GET /api/v1/schema/rent`.

If the advertised version is older than the client's, the client omits the newer fields.

## 3. Success response — `200 OK`

```json
{
  "api_version": "1.0",
  "request_id": "6f1c2a7e-0d4b-4c51-9a3e-1b2c3d4e5f60",
  "generated_at": "2026-11-15T10:15:00Z",
  "estimate": {
    "monthly_cold_rent": { "value": 1234.56, "currency": "EUR" },
    "rent_per_m2":       { "value": 12.34,   "currency": "EUR" },
    "interval": {
      "lower": 1111.11,
      "upper": 1333.33,
      "level": 0.8,
      "method": "quantile_regression"
    }
  },
  "model": {
    "name": "rent-model",
    "version": "0.0.0-example",
    "trained_at": "2026-11-01T00:00:00Z",
    "training_data": {
      "source_id": "example-source",
      "reference_period": { "start": "2000-01", "end": "2000-12" }
    }
  },
  "data_reference_date": "2000-12-31",
  "inputs": {
    "missing": ["building_era", "energy_class"],
    "imputed": [
      { "field": "building_era", "strategy": "model_native_missing" },
      { "field": "energy_class", "strategy": "category_unknown" }
    ]
  },
  "warnings": [
    { "code": "LOW_SUPPORT_REGION", "message": "Few training examples for this Ortsteil.", "field": "ortsteil" }
  ]
}
```

The example values are **sentinels** (1234.56, 2000-01, `0.0.0-example`), chosen so a leaked fixture is easy to recognize. They are not estimates.

| Field | Type | Notes |
|---|---|---|
| `api_version` | string | `"1.x"`. The client rejects a major version other than 1. |
| `estimate.monthly_cold_rent` | `{value: number > 0, currency: "EUR"}` | The point estimate. The UI shows it rounded to €10 and always next to the interval when one is present. |
| `estimate.rent_per_m2` | same, optional | |
| `estimate.interval` | object \| `null` | `level` ∈ (0, 1). `null` if the model has no calibrated interval. The UI then says "No uncertainty range available." It never invents one. |
| `model.*` | object | Shown in the result's legend rail |
| `data_reference_date` | ISO date | The period the training data represents. The UI shows "Reflects data up to …". |
| `inputs.missing` / `inputs.imputed` | arrays | The UI lists them under "What the model had to assume" |
| `warnings[]` | `{code, message, field?}` | Codes: `LOW_SUPPORT_REGION`, `OUT_OF_DISTRIBUTION`, `EXTRAPOLATION_AREA`, `STALE_MODEL`, `INPUT_INCONSISTENT`. Unknown codes are shown with their message (forward-compatible). |

### 3.1 Additions in draft.2 (all additive, so `api_version` stays `1.x`)

| Field | Meaning |
|---|---|
| `model.training_data.synthetic` | `true` when the training data is generated, not observed. **Required for this model.** The client treats a response without the flag as `not_connected` (D-058). |
| `estimate.interval.method` | `"split_conformal_log"`: split-conformal on the log scale, from in-time out-of-fold residuals of the last 12 data months. `level` is `0.8`. |
| `inputs.ignored` | Request fields that were sent and are not used (`property_type`, `transit_distance_min`, `lat`, `lon`) |
| `explanation` | `{ method, baseline_rent_per_m2, factors: [{ feature, effect_pct }] }`. The effect of each factor on rent per m² against the average training listing. For the linear model it is exact (coefficient × deviation). Groups: `location`, `market_period`, and single features. |
| warning `TRAINING_DATA_UNVERIFIED` | Always present for this model. |
| warning `STALE_MODEL` | Present when the data reference date is more than 180 days before the request. |

The Zod response schema ignores unknown keys. As of slice 10 it reads `synthetic`, `inputs.ignored` and `explanation`. `interpretPredictionResponse` shows an answer only when `synthetic` is `true` (`trainedOn: "synthetic"`). A 2xx answer with the flag missing or `false` becomes `not_connected` with reason `unverified_data`: lifting the demo label for a model trained on observed data is a separate decision (D-058, D-059).

## 4. Error envelope — any non-2xx

```json
{
  "api_version": "1.0",
  "request_id": "6f1c2a7e-0d4b-4c51-9a3e-1b2c3d4e5f60",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request has 1 invalid field.",
    "details": [ { "field": "area_m2", "issue": "must be >= 10" } ],
    "retryable": false
  }
}
```

| HTTP | `error.code` | Meaning | Frontend outcome |
|---|---|---|---|
| 400 | `UNSUPPORTED_API_VERSION` | Client and server major versions differ | `unavailable` (not retryable) |
| 422 | `VALIDATION_ERROR` | The payload failed the schema | `invalid_input`. Details are mapped back to form fields. |
| 422 | `OUT_OF_SUPPORT` | Valid input that the model refuses to extrapolate to | `rejected`, message shown |
| 429 | `RATE_LIMITED` | `Retry-After` header present | `unavailable` (retryable after the delay) |
| 503 | `MODEL_UNAVAILABLE` | Model not loaded or under maintenance | `unavailable` (retryable) |
| 504 | `UPSTREAM_TIMEOUT` | Inference timed out | `unavailable` (retryable) |
| 500 | `INTERNAL_ERROR` | Unexpected | `unavailable` |

**FastAPI note.** FastAPI's default 422 body is `{"detail":[{"loc":[...],"msg":...,"type":...}]}`. The ML team should install an exception handler that emits the envelope above. Until then, the frontend `HttpTransport` also accepts the default shape and maps `loc[-1]` to `field`.

Frontend-only codes, which the client produces and the server never sends:
- `PREDICTION_ENGINE_NOT_CONFIGURED`: the proxy has no upstream, or the mode is disabled
- `NETWORK_ERROR`
- `CLIENT_TIMEOUT`: the default is 10 s
- `INVALID_RESPONSE`: the body failed Zod parsing

## 5. Health — `GET /api/v1/health`

```json
{ "status": "ok", "model_loaded": true, "model_version": "0.0.0-example", "api_version": "1.0" }
```
`status` ∈ `ok | degraded | down`.

## 6. Non-functional expectations
- p95 latency ≤ 1 s for a single prediction, with a client timeout of 10 s.
- The service is idempotent for identical payloads within a model version.
- It doesn't log personally identifying data. The payload holds none by design, and there is no address field.
- CORS (only for `direct` mode): allow the frontend origin, `POST, GET`, and the headers `Content-Type, X-Request-ID`.

## 7. Frontend integration

```ts
// src/lib/api/prediction/types.ts (planned)
export type RentEstimateOutcome =
  | { status: "ok"; data: RentPredictionResponseV1 }
  | { status: "not_connected"; reason: "disabled" | "not_configured" | "unverified_data" }
  | { status: "invalid_input"; issues: { field: string; issue: string }[] }
  | { status: "rejected"; code: "OUT_OF_SUPPORT"; message: string }
  | { status: "unavailable"; code: string; retryable: boolean; retryAfterMs?: number };

export interface PredictionTransport {
  send(req: RentPredictionRequestV1, opts: { signal?: AbortSignal; requestId: string }): Promise<RentEstimateOutcome>;
}
```

- `DisabledTransport` is the default. It **returns** `{status:"not_connected", reason:"disabled"}` and never throws, so the UI renders it like any other outcome.
- `HttpTransport(baseUrl)` handles both `direct` (absolute URL) and `proxy` (`/api/predictions/rent`).
- The proxy route `src/app/api/predictions/rent/route.ts`:
  - validates the body with the same Zod request schema
  - returns `503 PREDICTION_ENGINE_NOT_CONFIGURED` when `PREDICTION_API_BASE_URL` is unset
  - in `embedded` mode, with no upstream configured, answers with `src/lib/model/rent-model.ts` in the same process (answer and errors use the same envelope; `503 MODEL_UNAVAILABLE` if it throws)
  - otherwise forwards the request with the server-only `PREDICTION_API_KEY` (if set) and a timeout, and passes the envelope through
- `PropertyAnalysisService.estimateRent(input)` maps `PropertyInput` to the request with `toRentPredictionRequest`, generates the request ID, calls the transport, and returns the outcome.

### Choosing a mode
| Backend situation | Mode | Env |
|---|---|---|
| No backend (today) | `disabled` | — |
| Public FastAPI with CORS and no secret | `direct` | `NEXT_PUBLIC_PREDICTION_MODE=direct`, `NEXT_PUBLIC_API_BASE_URL=https://…` |
| No separate backend, the demo model runs in the site's own server (D-061) | `embedded` | `NEXT_PUBLIC_PREDICTION_MODE=embedded` (build-time; works where only build variables exist, e.g. Netlify) |
| Backend needs a key, is private, or CORS is undesirable | `proxy` (**recommended**) | `NEXT_PUBLIC_PREDICTION_MODE=proxy`, `PREDICTION_API_BASE_URL=…`, `PREDICTION_API_KEY=…` (server-only) |

## 8. Contract tests

- Fixtures live in `tests/contracts/fixtures/` (`rent.v1.ok.json`, `rent.v1.ok-no-interval.json`, `rent.v1.ok-observed.json`, `rent.v1.ok-no-flag.json`, `rent.v1.error-validation.json`, `rent.v1.fastapi-default-422.json`, `rent.v1.error-unavailable.json`, `rent.v1.malformed.json`).
- These fixtures are **never** imported by `src/`. An ESLint rule and a boundary test enforce this.
- Tests check that each fixture parses (or fails) as expected, and that each maps to the right `RentEstimateOutcome`.
- When the ML team publishes an OpenAPI document, a CI step will compare it with this contract. Planned: generate a Zod schema from `openapi.json` and compare it.

## 9. Questions for the ML team, and the first model's answers (2026-10-30)
1. **Final feature names and enums.** The request fields stay as drafted. §2.1 lists how the model reads each one. `GET /api/v1/schema/rent` is served from the artifact's `feature_schema.json`.
2. **Target and reference period.** Cold rent (Nettokalt), modelled as `log(rent per m²)` and multiplied back by `area_m2`. Reference period 2020-01 to 2026-04-29. The model is served at its last data month, never extrapolated forward.
3. **Interval.** Calibrated: split conformal, level 0.8. Forward coverage measured on held-out months: 0.789 (2025) and 0.764 (2026), so it under-covers slightly when the market moves.
4. **Missing values.** Averaged over the training distribution of the missing field, and reported in `inputs`.
5. **`ortsteil_code` as join key.** Works for 80 of 97 Ortsteile. 15 are absent from the data and two names are ambiguous (§2.1).
6. **`has_balcony` and loggias.** Not answerable: the training data defines the field no further.
7. **Public or keyed deployment.** Open. Locally and for the demo, `proxy` mode against a local service.
