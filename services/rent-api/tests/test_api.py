"""Service tests. They run against the real artifact in artifacts/rent_v1 (no mocked model)."""
import json
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from rent_api.main import DEFAULT_ARTIFACT_DIR, create_app

REPO = Path(__file__).resolve().parents[3]
FULL = {
    "bezirk": "Mitte", "ortsteil": "Moabit", "ortsteil_code": "0102", "property_type": "apartment", "rooms": 2, "area_m2": 65,
    "floor": 2, "total_floors": 5, "building_era": "1950_1972", "energy_class": "D", "condition": "renovated",
    "has_lift": True, "has_balcony": True, "furnishing": "unfurnished", "transit_distance_min": None, "lat": None, "lon": None,
}
SPARSE = {"bezirk": "Neukölln", "property_type": "apartment", "rooms": 2.5, "area_m2": 65}


@pytest.fixture(scope="module")
def client():
    assert (DEFAULT_ARTIFACT_DIR / "metadata.json").exists(), f"artifact missing in {DEFAULT_ARTIFACT_DIR}"
    with TestClient(create_app()) as c:
        yield c


def post(client, payload, **kw):
    return client.post("/api/v1/predictions/rent", json=payload, **kw)


def test_health(client):
    body = client.get("/api/v1/health").json()
    assert body["status"] == "ok" and body["model_loaded"] is True and body["api_version"] == "1.0"
    assert body["model_version"].endswith("+linear")


def test_full_request_matches_contract_shape(client):
    r = post(client, FULL)
    assert r.status_code == 200
    b = r.json()
    e = b["estimate"]
    assert b["api_version"].startswith("1.")
    assert e["monthly_cold_rent"]["currency"] == "EUR" and e["monthly_cold_rent"]["value"] > 0
    assert e["rent_per_m2"]["value"] == pytest.approx(e["monthly_cold_rent"]["value"] / 65, abs=0.01)
    iv = e["interval"]
    assert iv["level"] == 0.8 and iv["method"] == "split_conformal_log"
    assert 0 < iv["lower"] < e["monthly_cold_rent"]["value"] < iv["upper"]
    assert b["inputs"]["missing"] == [] and b["inputs"]["imputed"] == []
    assert b["data_reference_date"] == "2026-04-29"
    assert b["model"]["training_data"]["synthetic"] is True  # D-058: the client relies on this flag
    codes = {w["code"] for w in b["warnings"]}
    assert "TRAINING_DATA_UNVERIFIED" in codes
    assert b["explanation"]["factors"] and b["explanation"]["baseline_rent_per_m2"] > 0


def test_estimates_match_the_values_the_colab_model_produced(client):
    """Golden values from the notebook's scikit-learn pipeline (same coefficients). The NumPy port must not drift."""
    e = post(client, FULL).json()["estimate"]
    assert e["monthly_cold_rent"]["value"] == pytest.approx(1204.85, abs=0.01)
    assert e["rent_per_m2"]["value"] == pytest.approx(18.54, abs=0.01)
    assert e["interval"]["lower"] == pytest.approx(951.42, rel=0.005)  # interval comes from a 1,001-point quantile grid
    assert e["interval"]["upper"] == pytest.approx(1440.96, rel=0.005)
    s = post(client, SPARSE).json()["estimate"]
    assert s["monthly_cold_rent"]["value"] == pytest.approx(780.63, abs=0.01)
    assert s["interval"]["lower"] == pytest.approx(545.05, rel=0.02) and s["interval"]["upper"] == pytest.approx(1074.88, rel=0.02)


def test_repo_contract_request_fixture_is_accepted(client):
    payload = json.loads((REPO / "tests" / "contracts" / "fixtures" / "rent.v1.request.json").read_text(encoding="utf-8"))
    r = post(client, payload)
    assert r.status_code == 200
    b = r.json()
    assert {"building_era", "energy_class", "condition", "has_lift"} <= set(b["inputs"]["missing"])
    assert any(w["code"] == "OUT_OF_DISTRIBUTION" and w["field"] == "rooms" for w in b["warnings"])  # 2.5 rooms


def test_request_id_is_echoed_or_generated(client):
    rid = str(uuid.uuid4())
    r = post(client, FULL, headers={"X-Request-ID": rid})
    assert r.json()["request_id"] == rid and r.headers["x-request-id"] == rid
    r2 = post(client, FULL, headers={"X-Request-ID": "not-a-uuid"})
    assert uuid.UUID(r2.json()["request_id"])


def test_identical_payloads_give_identical_estimates(client):
    a, b = post(client, SPARSE).json(), post(client, SPARSE).json()
    assert a["estimate"] == b["estimate"] and a["explanation"] == b["explanation"]


def test_missing_inputs_are_reported_and_widen_the_interval(client):
    full, sparse = post(client, FULL).json(), post(client, SPARSE).json()
    assert {"ortsteil", "building_era", "energy_class", "condition", "has_lift", "has_balcony", "furnishing", "floor", "total_floors"} <= set(sparse["inputs"]["missing"])
    assert all(i["strategy"] in {"train_distribution_marginalised", "bezirk_distribution"} for i in sparse["inputs"]["imputed"])

    def rel(b):
        e = b["estimate"]
        return (e["interval"]["upper"] - e["interval"]["lower"]) / e["monthly_cold_rent"]["value"]

    assert rel(sparse) > rel(full)


def test_larger_flat_costs_more(client):
    assert post(client, dict(FULL, area_m2=130)).json()["estimate"]["monthly_cold_rent"]["value"] > post(client, FULL).json()["estimate"]["monthly_cold_rent"]["value"]


def test_unused_fields_are_listed_not_used(client):
    a = post(client, dict(FULL, transit_distance_min=7)).json()
    assert a["inputs"]["ignored"] == ["property_type", "transit_distance_min"]
    assert a["estimate"] == post(client, dict(FULL, property_type="loft", transit_distance_min=50)).json()["estimate"]


@pytest.mark.parametrize("patch,field", [
    ({"area_m2": 5}, "area_m2"),
    ({"rooms": 2.3}, "rooms"),
    ({"floor": 9, "total_floors": 5}, "floor"),
    ({"color": "red"}, "color"),
    ({"bezirk": "Gotham"}, "bezirk"),
    ({"bezirk": "Spandau"}, "ortsteil"),  # Moabit does not belong to Spandau
    ({"ortsteil_code": "0101"}, "ortsteil"),  # code and name disagree
    ({"ortsteil_code": "9999"}, "ortsteil_code"),
    ({"lat": 52.5}, "lat"),
    ({"has_lift": "yes"}, "has_lift"),
    ({"transit_distance_min": 61}, "transit_distance_min"),
])
def test_invalid_requests_use_the_error_envelope(client, patch, field):
    r = post(client, dict(FULL, **patch))
    assert r.status_code == 422
    err = r.json()["error"]
    assert err["code"] == "VALIDATION_ERROR" and err["retryable"] is False
    assert field in {d["field"] for d in err["details"]}


def test_invalid_json_and_wrong_shape(client):
    r = client.post("/api/v1/predictions/rent", content=b"{nope", headers={"content-type": "application/json"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "VALIDATION_ERROR"
    assert post(client, [1, 2]).status_code == 422


def test_ortsteil_outside_the_training_data_falls_back_to_the_bezirk_with_a_warning(client):
    r = post(client, {"bezirk": "Steglitz-Zehlendorf", "ortsteil": "Schlachtensee", "property_type": "apartment", "rooms": 3, "area_m2": 80})
    assert r.status_code == 200
    assert any(w["code"] == "LOW_SUPPORT_REGION" for w in r.json()["warnings"])


def test_merged_ortsteil_warns(client):
    r = post(client, {"bezirk": "Lichtenberg", "ortsteil": "Alt-Hohenschönhausen", "property_type": "apartment", "rooms": 3, "area_m2": 80})
    assert r.status_code == 200
    assert any(w["code"] == "LOW_SUPPORT_REGION" for w in r.json()["warnings"])


def test_unicode_normalisation(client):
    nfd = "Neukölln".encode("utf-8").decode("utf-8")
    import unicodedata

    r = post(client, dict(SPARSE, bezirk=unicodedata.normalize("NFD", nfd)))
    assert r.status_code == 200


def test_model_card_and_schema(client):
    card = client.get("/api/v1/models/rent/current").json()
    assert card["synthetic"] is True and "DEMO-ONLY" in card["status"] and card["limitations"]
    sch = client.get("/api/v1/schema/rent").json()
    assert len(sch["bezirke"]) == 12 and "ignored_request_fields" in sch


def test_unknown_route_uses_the_envelope(client):
    r = client.get("/api/v1/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND"


def test_service_reports_unavailable_when_the_model_cannot_load(tmp_path):
    with TestClient(create_app(artifact_dir=tmp_path)) as c:
        assert c.get("/api/v1/health").json()["status"] == "down"
        r = c.post("/api/v1/predictions/rent", json=FULL)
        assert r.status_code == 503
        assert r.json()["error"]["code"] == "MODEL_UNAVAILABLE" and r.json()["error"]["retryable"] is True
