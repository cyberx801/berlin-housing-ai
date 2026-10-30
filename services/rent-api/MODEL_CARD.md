---
language: en
library_name: other
pipeline_tag: tabular-regression
tags:
  - tabular-regression
  - real-estate
  - berlin
  - rent
  - synthetic-data
  - demo
  - conformal-prediction
---

# Berlin rent model (demo, trained on synthetic data)

> **This model does not estimate Berlin rents.** It was trained on a dataset whose author states that the listing-level apartment characteristics are *generated from a hedonic pricing model*. The model learned to reproduce that generator. Its figures must not be used as a market estimate, a "fair rent" or advice of any kind.

A log-linear regression for the monthly **cold rent** (Nettokaltmiete) of a flat in Berlin, with an 80 % split-conformal interval. It is the demo model of the [Berlin Housing AI](https://github.com/cyberx801/berlin-housing-ai) portfolio project, where it runs behind a FastAPI service (`services/rent-api`) and is always shown under a demo label.

| | |
|---|---|
| Version | `0.1.0-research`, trained 2026-10-30 |
| Target | `log(rent per m²)`, multiplied back by the living area |
| Data reference date | 2026-04-29. The model is served at its last data month and is never extrapolated forward. |
| Status | **Demo only.** Prediction is off by default in the frontend. |

## Training data

[`sergionefedov/berlin-real-estate-sales-and-rentals-2020-2026`](https://www.kaggle.com/datasets/sergionefedov/berlin-real-estate-sales-and-rentals-2020-2026) on Kaggle, by Sergey Nefedov, Apache 2.0. Only `rentals.csv` (30,000 rows, 2020-01 to 2026-04) was used.

- According to the author, the Ortsteil coordinates, the stations and the interest-rate timeline are real. The listings are not observed.
- Our own checks agree: no missing values in any file, almost no round-number rents (1.1 % multiples of 100), a market level that changes in half-year steps (calendar year explains 94.8 % of month-level variance), and a station-distance field that names the nearest station in only 12 % of rows.
- Checksums of the five files are in the project's [`data/PROVENANCE.md`](../../data/PROVENANCE.md). The data is not redistributed here.

Because the generator is a log-linear model, **a log-linear fit is expected to work, and the error measures how well the generator is recovered.** It says nothing about real Berlin listings.

## Protocol

Chronological split: train 2020-01 to 2024-12 (23,779 rows), validation 2025 (4,711), test 2026-01 to 04-29 (1,510). A random split was treated as contaminated. Columns that are exact functions of the target (`rent_per_m2_kalt_eur`, `warmmiete_eur_monthly`, `warmmiete_eur_monthly_usd`) were excluded. The shipped artifact is refit on all rows, so it has no untouched holdout. The test numbers below belong to models fit on 2020 to 2024 only.

## Results

Mean absolute error in € per month, validation 2025, contract-feasible features:

| Model | MAE (€) |
|---|---|
| Median €/m² of the training data | 405 |
| Linear regression (**served**) | 144 |
| CatBoost (3 seeds) | 145 |
| Small neural network with embeddings (3 seeds) | 144 |

The three families tie (CatBoost minus linear: +1.1 €, 95 % CI −1.7 to +3.8). That is a property of the data, not evidence that boosting or neural networks cannot help. LightGBM was not tried. On the 2026 test the linear model had an MAE of 156 € and a bias of +77 €, because its time trend kept rising while the level of the data flattened. The served model therefore fixes the time at the last data month.

**Interval.** Split conformal on the log scale, from in-time out-of-fold residuals of the last 12 data months, level 0.8. Forward coverage on held-out months: 0.789 (2025) and 0.764 (2026), slightly under the nominal level when the market moves.

## Inputs

Ortsteil (82 levels, the Bezirk average when missing), living area, rooms (whole rooms 1 to 5), floor (0 to 8), total floors (3 to 8), building era (4 bands), energy class, condition, furnished, lift, balcony. Fields left open are averaged over their training distribution, assuming independence, and the interval widens. `property_type` and the walk to the nearest station are accepted by the API and ignored: in the data the first is only a label for the room count, and the second does not mean what the field suggests.

## Limitations

- Synthetic training data (above). Nothing here is a statement about real rents.
- Only 80 of the 97 official Ortsteile are covered unambiguously: 15 are absent from the data, and "Hohenschönhausen" and "Treptow" are ambiguous.
- Rooms are integers 1 to 5 in the data. Half rooms are rounded, larger values are capped, with a warning.
- Unknown inputs are averaged assuming independence between the unknown fields.
- The data ends in April 2026. Rents move, and the service warns after 180 days.

## Files

| File | |
|---|---|
| `linear_model.json` | standardisation constants, coefficients, one coefficient per category, intercept. Evaluated with NumPy, no pickle. |
| `residual_quantiles.json` | the quantile grid behind the interval |
| `feature_schema.json` | feature order, Ortsteil centres, ALKIS codes, enum maps, training marginals |
| `metadata.json` | version, data fingerprint, split protocol, metrics, limitations |
| `experiments.csv` | every experiment, including the negative ones |

The service, the contract and its tests are in the [repository](https://github.com/cyberx801/berlin-housing-ai/tree/main/services/rent-api). The numbers in `linear_model.json` match the training notebook's scikit-learn pipeline to 1.3e-15 on 30,000 rows, and a golden-value test keeps it that way.

## Before publishing this card on the Hugging Face Hub

- Choose a licence for the model files and add it to the front matter (`license:`). The repository has no `LICENSE` file yet.
- Upload the five files in `artifacts/rent_v1/` together with this file renamed to `README.md`.
- Keep the first paragraph. It is the point of the card.
