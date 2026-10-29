# Vision: why Berlin Housing AI exists

> Status: agreed direction with the owner (2026-10-30). Each phase below still needs its own go-ahead before work starts. Phases 2 and 3 also need a cost approval.

## 1. The question the product answers

**"Is this rent fair?"** A renter pastes or enters a listing. They get:
- a model estimate of the rent per m²,
- a range for comparable flats,
- where the listing sits in that range (below, within or above),
- the reasons behind it.

Official context sits next to the estimate: neighbourhood geodata and, later, the Mietspiegel.

The frontend (slices 1–9) is the honest shell for this. Prediction stays disabled until a real model answers through the contract in `docs/contracts/PREDICTION_API.md`.

## 2. Phases

### Phase 1: model and evaluation (next)
- Train in Colab, outside this repo. The ML notebooks are not rewritten or discarded.
- Serve the model through a FastAPI service behind the existing `/api` proxy. The service holds no secrets client-side.
- The frontend switches from "not connected" to real `model` provenance. No other screen changes its data rules.

### Phase 2: saved searches and alerts
- The user forwards their own portal alert emails (for example ImmoScout24 search alerts) to the service. The service scores each listing and notifies the user when one is good.
- **No scraping.** Portal terms forbid it. An official API (ImmoScout24 partner access) is an option only if granted.
- Needs accounts, a database, email or push delivery and an always-on server. That means a monthly cost, which needs the owner's approval first.

### Phase 3: application pack (not auto-apply)
- When the user says "apply", the service prepares a tailored message and a document checklist. **The user sends it themselves.**
- Full auto-apply is ruled out:
  - It breaks portal terms and risks the user's account.
  - Storing SCHUFA, payslips and ID documents is a heavy GDPR liability.
  - Landlords filter bot applications.
- Storing documents at all needs a separate privacy decision.

## 3. Model plan (for the ML session)

| Step | Model | Why |
|---|---|---|
| 1 | Linear regression on `log(rent per m²)` | Baseline. Coefficients are the explanation. |
| 2 | LightGBM (gradient boosting) | Usually the strongest on tabular data. Explained with SHAP. |
| 3 | Comparison | Same held-out split, MAE in €/m². The winner is served. The comparison is published on `/methodology`. |
| 4 | Neural network (optional, later) | For learning or portfolio, or once unstructured inputs (listing text, photos) exist. Not expected to beat step 2 on tabular data. |

**The service must return:**
- a point estimate,
- an interval (for example P10–P90, via quantile regression or LightGBM quantile mode),
- per-feature contributions,
- model version and training-data period.

The contract in `PREDICTION_API.md` is frozen to this shape once the feature schema is known.

**Data preconditions (DATA_BOUNDARIES §4):**
- the source URL and licence of the Kaggle data,
- the years it covers (old rents must not judge 2026 listings without saying so),
- the intake checks passed.

## 4. Non-goals
- Scraping listing portals.
- Fully automatic applications.
- Paid AI or LLM APIs.
- Any number that looks like a rent but didn't come from the model.

## 5. Handover to the ML session
The ML work runs in Colab, connected through MCP. Start the session with:

> Read `berlin-housing-ai/docs/product/VISION.md`, `docs/contracts/PREDICTION_API.md` and `docs/architecture/DATA_BOUNDARIES.md`. We're starting the ML phase.
