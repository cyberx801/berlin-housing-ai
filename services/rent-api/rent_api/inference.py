"""Rent model inference for the demo service (D-058).

Loads one artifact directory (feature_schema.json, metadata.json, the model, calibration residuals) and answers
requests shaped like docs/contracts/PREDICTION_API.md. The model is trained on synthetic data; every response says so.
"""
import datetime
import json
import math
import os
import unicodedata
import uuid

import numpy as np
import pandas as pd

API_VERSION = "1.0"
LEVEL = 0.8
SEED = 20261030  # fixed, so identical payloads give identical answers
N_SAMPLES = 4000
STALE_AFTER_DAYS = 180
REQUEST_FIELDS = {
    "bezirk", "ortsteil", "ortsteil_code", "property_type", "rooms", "area_m2", "floor", "total_floors", "building_era",
    "energy_class", "condition", "has_lift", "has_balcony", "furnishing", "transit_distance_min", "lat", "lon",
}
ENUMS = {
    "property_type": {"apartment", "maisonette", "penthouse", "loft", "house", "other"},
    "building_era": {"pre_1919", "1919_1949", "1950_1972", "1973_1990", "1991_2009", "2010_plus", "unknown"},
    "energy_class": {"A_plus", "A", "B", "C", "D", "E", "F", "G", "H", "unknown"},
    "condition": {"first_occupancy", "renovated", "well_kept", "needs_renovation", "unknown"},
    "furnishing": {"unfurnished", "partly_furnished", "furnished", "unknown"},
}
GROUPS = {"ortsteil_key": "location", "bezirk": "location", "ortsteil_centre_km": "location", "t_month": "market_period"}


def _nfc(value):
    return unicodedata.normalize("NFC", value) if isinstance(value, str) else value


def _haversine_km(lat1, lon1, lat2, lon2):
    p = np.pi / 180
    a = np.sin((lat2 - lat1) * p / 2) ** 2 + np.cos(lat1 * p) * np.cos(lat2 * p) * np.sin((lon2 - lon1) * p / 2) ** 2
    return 12742 * np.arcsin(np.sqrt(a))


def _load_json(art_dir, name):
    with open(os.path.join(art_dir, name), encoding="utf-8") as f:
        return json.load(f)


class RentModel:
    """Log-linear model on log(rent per m2), evaluated with NumPy only (no pickle, no scikit-learn)."""

    def __init__(self, art_dir):
        self.schema = _load_json(art_dir, "feature_schema.json")
        self.meta = _load_json(art_dir, "metadata.json")
        self.lin = _load_json(art_dir, "linear_model.json")
        grid = _load_json(art_dir, "residual_quantiles.json")
        self.resid_q = np.array(grid["log_residual_quantiles"], dtype="float64")
        self.resid_levels = np.linspace(0.0, 1.0, len(self.resid_q))
        self._num_mean = np.array(self.lin["mean"])
        self._num_scale = np.array(self.lin["scale"])
        self._num_coef = np.array(self.lin["coef_num"])

    @property
    def version(self):
        return f'{self.meta["version"]}+linear'

    def _predict_log_m2(self, X):
        z = (X[self.lin["num_features"]].astype(float).values - self._num_mean) / self._num_scale
        out = z @ self._num_coef + self.lin["intercept"]
        for col in self.lin["cat_features"]:
            out = out + X[col].map(self.lin["coef_cat"][col]).fillna(0.0).values  # unseen category -> 0, as in training
        return out

    def _residual_quantile(self, levels):
        return np.interp(levels, self.resid_levels, self.resid_q)

    # ---------------------------------------------------------------- validation (mirrors the Zod request schema)
    def _validate(self, req):
        errs = [{"field": k, "issue": "unknown field"} for k in req if k not in REQUEST_FIELDS]

        def num(name, lo, hi, integer=False, half=False, required=False):
            v = req.get(name)
            if v is None:
                if required:
                    errs.append({"field": name, "issue": "is required"})
                return None
            if isinstance(v, bool) or not isinstance(v, (int, float)) or (isinstance(v, float) and not math.isfinite(v)):
                errs.append({"field": name, "issue": "must be a number"})
            elif integer and float(v) != int(v):
                errs.append({"field": name, "issue": "must be an integer"})
            elif half and (float(v) * 2) != int(float(v) * 2):
                errs.append({"field": name, "issue": "must be a multiple of 0.5"})
            elif not (lo <= v <= hi):
                errs.append({"field": name, "issue": f"must be between {lo} and {hi}"})
            else:
                return v
            return None

        bezirk = _nfc(req.get("bezirk"))
        if bezirk is None:
            errs.append({"field": "bezirk", "issue": "is required"})
        elif bezirk not in self.schema["bezirke"]:
            errs.append({"field": "bezirk", "issue": "must be one of the 12 Berlin Bezirke"})
        if req.get("property_type") is None:
            errs.append({"field": "property_type", "issue": "is required"})
        for field, allowed in ENUMS.items():
            if req.get(field) is not None and req[field] not in allowed:
                errs.append({"field": field, "issue": "invalid value"})
        rooms = num("rooms", 1, 10, half=True, required=True)
        area = num("area_m2", 10, 500, required=True)
        floor = num("floor", -1, 60, integer=True)
        total = num("total_floors", 1, 60, integer=True)
        num("transit_distance_min", 0, 60, integer=True)
        if floor is not None and total is not None and floor > total:
            errs.append({"field": "floor", "issue": "must be <= total_floors"})
        for field in ("has_lift", "has_balcony"):
            if req.get(field) is not None and not isinstance(req[field], bool):
                errs.append({"field": field, "issue": "must be boolean or null"})
        if (req.get("lat") is None) != (req.get("lon") is None):
            errs.append({"field": "lat", "issue": "lat and lon must be given together"})
        return errs, {"bezirk": bezirk, "rooms": rooms, "area": area, "floor": floor, "total": total}

    # ---------------------------------------------------------------- request -> known values + distributions for unknowns
    def _resolve(self, req, v, warnings, missing, imputed):
        s = self.schema
        marg = s["marginals"]
        known, dist = {"bezirk": v["bezirk"]}, {}

        def marginalise(field, request_name, counts):
            missing.append(request_name)
            imputed.append({"field": request_name, "strategy": "train_distribution_marginalised"})
            dist[field] = counts

        name = None
        if req.get("ortsteil_code"):
            name = s["alkis_code_to_name"].get(req["ortsteil_code"])
            if name is None:
                return {"field": "ortsteil_code", "issue": "unknown ALKIS Ortsteil code"}
        if req.get("ortsteil"):
            given = _nfc(req["ortsteil"])
            if name is not None and given != name:
                return {"field": "ortsteil", "issue": "does not match ortsteil_code"}
            name = given
        key = None
        if name is not None:
            key = s["alkis_name_alias"].get(name, name)
            if key not in s["ortsteil_bezirk"]:
                warnings.append({"code": "LOW_SUPPORT_REGION", "field": "ortsteil",
                                 "message": "This Ortsteil is not in the training data; the estimate uses the Bezirk average."})
                key = None
            elif s["ortsteil_bezirk"][key] != v["bezirk"]:
                return {"field": "ortsteil", "issue": "does not belong to bezirk"}
            elif name in s["alkis_name_alias"]:
                warnings.append({"code": "LOW_SUPPORT_REGION", "field": "ortsteil",
                                 "message": "Training data merges Alt- and Neu-Hohenschoenhausen; the merged level is used."})
        if key is not None:
            known["ortsteil_key"] = key
        else:
            missing.append("ortsteil")
            imputed.append({"field": "ortsteil", "strategy": "bezirk_distribution"})
            dist["ortsteil_key"] = s["ortsteil_by_bezirk"][v["bezirk"]]

        rooms = min(max(int(math.floor(v["rooms"] + 0.5)), 1), 5)
        if rooms != v["rooms"]:
            warnings.append({"code": "OUT_OF_DISTRIBUTION", "field": "rooms",
                             "message": "The model knows whole rooms 1-5; the value was adjusted."})
        known["rooms"], known["area_m2"] = float(rooms), float(v["area"])
        lo, hi = s["ranges"]["area_m2"]
        if not lo <= v["area"] <= hi:
            warnings.append({"code": "OUT_OF_DISTRIBUTION", "field": "area_m2",
                             "message": f"Living area is outside the training range ({lo:.0f}-{hi:.0f} m2)."})

        def categorical(field, request_name, mapper):
            value = req.get(request_name)
            mapped = mapper(value) if value not in (None, "unknown") else None
            if mapped is None:
                marginalise(field, request_name, marg[field])
                if value not in (None, "unknown"):
                    warnings.append({"code": "INPUT_INCONSISTENT", "field": request_name,
                                     "message": f"'{value}' has no counterpart in the training data and was treated as unknown."})
            else:
                known[field] = mapped

        categorical("building_era", "building_era", s["enum_map"]["building_era"].get)
        categorical("energy_class", "energy_class", lambda x: x if x in s["energy_classes"] else None)
        categorical("condition", "condition", s["enum_map"]["condition"].get)
        for field in ("has_lift", "has_balcony"):
            if req.get(field) is None:
                marginalise(field, field, marg[field])
            else:
                known[field] = int(req[field])
        furnished = s["enum_map"]["furnishing"].get(req.get("furnishing"))
        if furnished is None:
            marginalise("furnished", "furnishing", marg["furnished"])
        else:
            known["furnished"] = furnished

        floor, total = v["floor"], v["total"]
        if floor == -1:
            floor = 0
            warnings.append({"code": "OUT_OF_DISTRIBUTION", "field": "floor",
                             "message": "Basement floors are not in the training data; treated as ground floor."})
        if (floor is not None and floor > 8) or (total is not None and total > 8):
            warnings.append({"code": "OUT_OF_DISTRIBUTION", "field": "floor",
                             "message": "Floor counts above 8 are not in the training data; the value was capped."})
        if floor is not None:
            known["floor"] = float(min(floor, 8))
        if total is not None:
            known["total_floors"] = float(min(total, 8))
        if floor is None:
            missing.append("floor")
            imputed.append({"field": "floor", "strategy": "train_distribution_marginalised"})
        if total is None:
            missing.append("total_floors")
            imputed.append({"field": "total_floors", "strategy": "train_distribution_marginalised"})
        if floor is None or total is None:
            pairs = [p for p in marg["floor_total_pairs"]
                     if (floor is None or p[0] == known["floor"]) and (total is None or p[1] == known["total_floors"])]
            dist["_pairs"] = pairs or marg["floor_total_pairs"]
        return known, dist

    # ---------------------------------------------------------------- feature frame (the same columns, order and types as training)
    def _frame(self, known, dist, seed):
        s = self.schema
        rng = np.random.default_rng(seed)
        n = N_SAMPLES if dist else 1
        cols = {k: [val] * n for k, val in known.items()}
        for field, counts in dist.items():
            if field == "_pairs":
                pairs = np.array(counts, dtype=float)
                pick = rng.choice(len(pairs), n, p=pairs[:, 2] / pairs[:, 2].sum())
                if "floor" not in known:
                    cols["floor"] = pairs[pick, 0].tolist()
                if "total_floors" not in known:
                    cols["total_floors"] = pairs[pick, 1].tolist()
                continue
            keys = list(counts)
            weights = np.array([counts[k] for k in keys], dtype=float)
            chosen = rng.choice(len(keys), n, p=weights / weights.sum())
            cols[field] = [keys[i] for i in chosen]
            if field in ("has_lift", "has_balcony", "furnished"):
                cols[field] = [int(x) for x in cols[field]]
        df = pd.DataFrame(cols)
        centres = s["centroids"]
        lat = np.array([centres[k][0] for k in df["ortsteil_key"]])
        lon = np.array([centres[k][1] for k in df["ortsteil_key"]])
        df["ortsteil_centre_km"] = _haversine_km(lat, lon, *s["brandenburg_gate"])
        df["t_month"] = float(s["t_ref"])  # served at the last data month, never extrapolated
        for c in s["cat_features"]:
            df[c] = df[c].astype(str)
        for c in s["num_features"]:
            df[c] = df[c].astype(float)
        return df[s["feature_order"]]

    # ---------------------------------------------------------------- explanation
    def _explain(self, X, pred_mean):
        """Exact effect of each feature on log(rent per m2) against the average training listing."""
        s = self.schema
        contrib = {}
        z = (X[self.lin["num_features"]].astype(float).values - self._num_mean) / self._num_scale
        for i, f in enumerate(self.lin["num_features"]):
            contrib[f] = float((z[:, i] * self._num_coef[i]).mean())
        for f in self.lin["cat_features"]:
            coef, freq = self.lin["coef_cat"][f], s["cat_freq"][f]
            total = sum(freq.values())
            average = sum(coef.get(k, 0.0) * c / total for k, c in freq.items())
            contrib[f] = float((X[f].map(coef).fillna(0.0) - average).mean())
        grouped = {}
        for f, c in contrib.items():
            grouped[GROUPS.get(f, f)] = grouped.get(GROUPS.get(f, f), 0.0) + c
        return float(np.exp(pred_mean - sum(grouped.values()))), grouped

    # ---------------------------------------------------------------- public API
    def predict(self, request, request_id=None, now=None):
        """Returns (http_status, body). Never raises for bad input."""
        rid = request_id or str(uuid.uuid4())
        now = now or datetime.datetime.now(datetime.timezone.utc)

        def error(status, code, message, details=None):
            body = {"api_version": API_VERSION, "request_id": rid,
                    "error": {"code": code, "message": message, "details": details or [], "retryable": False}}
            return status, body

        if not isinstance(request, dict):
            return error(422, "VALIDATION_ERROR", "Request must be a JSON object.")
        errs, v = self._validate(request)
        if errs:
            return error(422, "VALIDATION_ERROR", f"Request has {len(errs)} invalid field(s).", errs)
        warnings, missing, imputed = [], [], []
        resolved = self._resolve(request, v, warnings, missing, imputed)
        if isinstance(resolved, dict):
            return error(422, "VALIDATION_ERROR", "Request has 1 invalid field.", [resolved])
        known, dist = resolved

        X = self._frame(known, dist, SEED)
        pred = self._predict_log_m2(X)
        area = known["area_m2"]
        tails = [(1 - LEVEL) / 2, 1 - (1 - LEVEL) / 2]
        if not dist:
            point = float(np.exp(pred[0]) * area)
            q = self._residual_quantile(tails)
            lower, upper, pred_mean = point * float(np.exp(q[0])), point * float(np.exp(q[1])), float(pred[0])
        else:
            rng = np.random.default_rng(SEED + 1)
            draws = np.exp(pred + self._residual_quantile(rng.random(len(pred)))) * area
            lower, upper = (float(x) for x in np.quantile(draws, tails))
            pred_mean = float(pred.mean())
            point = float(np.exp(pred_mean) * area)
        baseline, grouped = self._explain(X, pred_mean)

        reference = datetime.date.fromisoformat(self.schema["data_reference_date"])
        if (now.date() - reference).days > STALE_AFTER_DAYS:
            warnings.append({"code": "STALE_MODEL", "message": f"Training data ends {reference.isoformat()}; rents may have moved since."})
        warnings.append({"code": "TRAINING_DATA_UNVERIFIED",
                         "message": "Demo model: the training data is synthetic. Not a Berlin market estimate."})
        factors = sorted(({"feature": k, "effect_pct": round((math.exp(c) - 1) * 100, 1)} for k, c in grouped.items()),
                         key=lambda d: -abs(d["effect_pct"]))
        return 200, {
            "api_version": API_VERSION,
            "request_id": rid,
            "generated_at": now.isoformat(timespec="seconds"),
            "estimate": {
                "monthly_cold_rent": {"value": round(point, 2), "currency": "EUR"},
                "rent_per_m2": {"value": round(point / area, 2), "currency": "EUR"},
                "interval": {"lower": round(lower, 2), "upper": round(upper, 2), "level": LEVEL, "method": "split_conformal_log"},
            },
            "model": {
                "name": self.meta["name"],
                "version": self.version,
                "trained_at": self.meta["trained_at"],
                "training_data": {
                    "source_id": "kaggle-berlin-5csv",
                    "synthetic": bool(self.meta.get("data", {}).get("synthetic", True)),
                    "reference_period": self.schema["reference_period"],
                },
            },
            "data_reference_date": self.schema["data_reference_date"],
            "inputs": {"missing": sorted(set(missing)), "imputed": imputed,
                       "ignored": [f for f in self.schema["ignored_request_fields"] if request.get(f) is not None]},
            "warnings": warnings,
            "explanation": {
                "method": "log-linear coefficients",
                "baseline_rent_per_m2": round(baseline, 2),
                "factors": factors[:8],
            },
        }
