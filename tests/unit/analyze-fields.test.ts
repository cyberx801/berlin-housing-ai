import { fingerprint, formFieldForWire } from "@/features/property-analysis/fields";
import { randomId } from "@/lib/id";
import { formatIsoDate } from "@/lib/formatting/date";
import { EMPTY_PROPERTY_FORM } from "@/lib/validation/property";

describe("formFieldForWire", () => {
  it.each([
    ["area_m2", "area"],
    ["body.total_floors", "totalFloors"],
    ["ortsteil_code", "ortsteil"],
    ["has_lift", "lift"],
    ["transit_distance_min", "transitMinutes"],
  ])("maps the contract field %s to the form field %s", (wire, form) => {
    expect(formFieldForWire(wire)).toBe(form);
  });

  it.each(["lat", "request", "constructor", "__proto__", ""])("returns null for %j", (wire) => {
    expect(formFieldForWire(wire)).toBeNull();
  });
});

describe("fingerprint", () => {
  it("ignores key order and changes with any value", () => {
    const reordered = Object.fromEntries(Object.entries(EMPTY_PROPERTY_FORM).reverse());
    expect(fingerprint(reordered)).toBe(fingerprint(EMPTY_PROPERTY_FORM));
    expect(fingerprint({ ...EMPTY_PROPERTY_FORM, area: "65" })).not.toBe(fingerprint(EMPTY_PROPERTY_FORM));
  });
});

describe("formatIsoDate", () => {
  it.each([
    ["2000-12-31", "31 December 2000"],
    ["2026-11-01T00:00:00Z", "1 November 2026"],
    ["2000-01", "January 2000"],
    ["last spring", "last spring"],
  ])("formats %j as %j", (iso, text) => {
    expect(formatIsoDate(iso)).toBe(text);
  });
});

describe("randomId", () => {
  it("falls back to getRandomValues outside a secure context", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", { value: undefined, configurable: true });
    try {
      expect(randomId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    } finally {
      Object.defineProperty(crypto, "randomUUID", { value: original, configurable: true });
    }
  });
});
