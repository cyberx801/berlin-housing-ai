# Rent service (demo model)

FastAPI service for the model built in the ML phase. **The model is trained on synthetic data** (`data/PROVENANCE.md`, D-058): every response carries `model.training_data.synthetic: true` and the warning `TRAINING_DATA_UNVERIFIED`, and the frontend shows it only under the demo label. It does not estimate Berlin market rents.

Contract: `docs/contracts/PREDICTION_API.md` (draft.2). Endpoints:

| Method | Path | |
|---|---|---|
| POST | `/api/v1/predictions/rent` | the estimate, an 80 % interval, the inputs it had to assume, factor effects |
| GET | `/api/v1/health` | liveness and the loaded model |
| GET | `/api/v1/models/rent/current` | model card: status, split protocol, validation and test metrics, limitations |
| GET | `/api/v1/schema/rent` | Bezirke, Ortsteile, enums and the fields the model ignores |

All non-2xx answers use the contract's error envelope, including FastAPI's own 422.

## Run

Python 3.12. On this machine it is at `%LOCALAPPDATA%\Programs\Python\Python312` and is not on PATH.

```powershell
cd services/rent-api
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements-dev.txt   # fastapi, numpy, pandas, pytest, httpx
.\.venv\Scripts\python -m pytest
.\.venv\Scripts\python -m uvicorn rent_api.main:app --port 8000
```

Then point the Next.js proxy at it (`PREDICTION_API_BASE_URL=http://127.0.0.1:8000`, `NEXT_PUBLIC_PREDICTION_MODE=proxy`).

Setting: `RENT_MODEL_DIR` (artifact folder, default `artifacts/rent_v1`).

## Artifact (`artifacts/rent_v1/`)

The model is a log-linear regression on `log(rent per m²)`, stored as plain JSON and evaluated with NumPy. There is no pickle and no scikit-learn at run time. The numbers in `linear_model.json` are exactly those of the notebook's scikit-learn pipeline (maximum difference 1.3e-15 on 30,000 rows), and a golden-value test keeps it that way.

| File | |
|---|---|
| `linear_model.json` | standardisation constants, numeric coefficients, one coefficient per category, intercept |
| `residual_quantiles.json` | 1,001-point quantile grid of the in-time out-of-fold log residuals of the last 12 data months, used for the interval |
| `feature_schema.json` | feature order, Ortsteil centres, ALKIS codes, enum maps, training marginals |
| `metadata.json` | version, data fingerprint (SHA-256), split protocol, metrics, limitations |
| `experiments.csv` | every experiment of the ML phase, including the negative ones |

The CatBoost challenger (1.7 MB) and the notebook are not in this repository. CatBoost was not shown to be better (`experiments.csv`, VISION §3.1).

## How it behaves

- Served at the last data month (2026-04), never extrapolated. `STALE_MODEL` appears when the request is more than 180 days later.
- Missing inputs are averaged over their training distribution (independent fields assumed), and listed in `inputs`. The interval widens.
- Identical payloads give identical answers (fixed seed).
- The service logs no request payloads and needs no secrets.

## Not covered

No auth, rate limiting or CORS: it is meant to sit behind the Next.js `/api` proxy. No deployment. The training notebook is not in this repository.
