"""Writes tests/unit/rent-model.golden.json: the Python service's answers for a set of requests.

The TypeScript port (src/lib/model/rent-model.ts) is tested against this file.
Run from the repo root:  services/rent-api/.venv/Scripts/python.exe scripts/build-rent-golden.py
"""
import datetime
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "rent-api"))
from rent_api.inference import RentModel  # noqa: E402

FULL = {
    "bezirk": "Mitte", "ortsteil": "Moabit", "ortsteil_code": "0102", "property_type": "apartment", "rooms": 2, "area_m2": 65,
    "floor": 2, "total_floors": 5, "building_era": "1950_1972", "energy_class": "D", "condition": "renovated",
    "has_lift": True, "has_balcony": True, "furnishing": "unfurnished", "transit_distance_min": None, "lat": None, "lon": None,
}
CASES = {
    "full": FULL,
    "sparse": {"bezirk": "Neukölln", "property_type": "apartment", "rooms": 2.5, "area_m2": 65},
    "large_flat": dict(FULL, area_m2=130, rooms=4),
    "old_building_far_out": {"bezirk": "Spandau", "property_type": "apartment", "rooms": 3, "area_m2": 82, "floor": 0,
                             "total_floors": 4, "building_era": "pre_1919", "energy_class": "H", "condition": "needs_renovation"},
    "floor_only": {"bezirk": "Pankow", "property_type": "apartment", "rooms": 1, "area_m2": 32, "floor": 3},
    "ortsteil_not_trained": {"bezirk": "Steglitz-Zehlendorf", "ortsteil": "Schlachtensee", "property_type": "apartment",
                             "rooms": 3, "area_m2": 80},
    "merged_ortsteil": {"bezirk": "Lichtenberg", "ortsteil": "Alt-Hohenschönhausen", "property_type": "apartment",
                        "rooms": 3, "area_m2": 80, "has_lift": False},
    "tall_basement": dict(FULL, floor=-1, total_floors=12, area_m2=120),
    "furnished_new_build": dict(FULL, building_era="2010_plus", energy_class="A_plus", condition="first_occupancy",
                                furnishing="furnished"),
    "ignored_fields": dict(FULL, transit_distance_min=7, property_type="loft"),
    "invalid_area": dict(FULL, area_m2=5),
    "invalid_rooms": dict(FULL, rooms=2.3),
    "wrong_bezirk": dict(FULL, bezirk="Spandau"),
    "code_mismatch": dict(FULL, ortsteil_code="0101"),
    "unknown_code": dict(FULL, ortsteil_code="9999"),
    "unknown_field": dict(FULL, color="red"),
}
NOW = datetime.datetime(2026, 10, 30, 12, 0, 0, tzinfo=datetime.timezone.utc)

model = RentModel(str(ROOT / "services" / "rent-api" / "artifacts" / "rent_v1"))
out = {}
for name, payload in CASES.items():
    status, body = model.predict(payload, request_id="golden", now=NOW)
    out[name] = {"request": payload, "status": status, "body": body}
target = ROOT / "tests" / "unit" / "rent-model.golden.json"
target.write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(f"wrote {target} ({len(out)} cases)")
