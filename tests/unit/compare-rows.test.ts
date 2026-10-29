import {
  ATTRIBUTE_ROWS,
  defaultCompareLabel,
  defaultLabelFor,
  DETAIL_ROWS,
  formatRent,
  formatRentPerM2,
  listingHost,
  rentPerM2,
  type PlaceNames,
} from "@/features/property-comparison/rows";
import type { CompareItem } from "@/features/property-comparison/store";

const names: PlaceNames = {
  bezirkName: (code) => ({ "01": "Mitte", "04": "Charlottenburg-Wilmersdorf" })[code],
  ortsteilName: (code) => ({ "0102": "Moabit" })[code],
};

const item = (overrides: Partial<CompareItem> = {}, property: Partial<CompareItem["property"]> = {}): CompareItem => ({
  id: "a",
  label: "A",
  askingColdRent: null,
  listingUrl: null,
  source: "manual",
  addedAt: "2026-10-29T10:00:00.000Z",
  ...overrides,
  property: {
    bezirkCode: "01",
    ortsteilCode: "0102",
    address: null,
    propertyType: "apartment",
    areaM2: 65,
    rooms: 2.5,
    floor: 2,
    totalFloors: 5,
    buildingEra: "unknown",
    energyClass: "unknown",
    condition: "unknown",
    hasLift: null,
    hasBalcony: true,
    furnishing: "unfurnished",
    transitMinutes: null,
    ...property,
  },
});

// Values use a narrow no-break space before units; compare with plain spaces.
const plain = (value: string | null) => value?.replaceAll(" ", " ") ?? null;
const row = (rows: typeof ATTRIBUTE_ROWS, key: string, it: CompareItem) =>
  plain(rows.find((r) => r.key === key)!.value(it, names));

describe("comparison rows", () => {
  it("shows what was entered and marks the rest as missing", () => {
    const it = item();
    expect(row(ATTRIBUTE_ROWS, "ortsteil", it)).toBe("Moabit");
    expect(row(ATTRIBUTE_ROWS, "bezirk", it)).toBe("Mitte");
    expect(row(ATTRIBUTE_ROWS, "propertyType", it)).toBe("Apartment");
    expect(row(ATTRIBUTE_ROWS, "area", it)).toBe("65 m²");
    expect(row(ATTRIBUTE_ROWS, "rooms", it)).toBe("2.5");
    expect(row(DETAIL_ROWS, "floor", it)).toBe("2");
    expect(row(DETAIL_ROWS, "totalFloors", it)).toBe("5");
    expect(row(DETAIL_ROWS, "balcony", it)).toBe("Yes");
    expect(row(DETAIL_ROWS, "furnishing", it)).toBe("Unfurnished");
    // "Not sure" and empty answers are both missing (PRD F3).
    for (const key of ["buildingEra", "energyClass", "condition", "lift", "transitMinutes"]) {
      expect(row(DETAIL_ROWS, key, it), key).toBeNull();
    }
    expect(row(ATTRIBUTE_ROWS, "ortsteil", item({}, { ortsteilCode: null }))).toBeNull();
  });

  it("names the ground floor and souterrain as listings do", () => {
    expect(row(DETAIL_ROWS, "floor", item({}, { floor: 0 }))).toBe("Ground floor");
    expect(row(DETAIL_ROWS, "floor", item({}, { floor: -1 }))).toBe("Souterrain");
    expect(row(DETAIL_ROWS, "floor", item({}, { floor: null }))).toBeNull();
    expect(row(DETAIL_ROWS, "lift", item({}, { hasLift: false }))).toBe("No");
  });

  it("works out €/m² from the user's rent and area only, and not without a rent", () => {
    expect(rentPerM2(item())).toBeNull();
    expect(formatRentPerM2(item())).toBeNull();
    expect(rentPerM2(item({ askingColdRent: 1150 }))).toBeCloseTo(17.6923, 4);
    expect(plain(formatRentPerM2(item({ askingColdRent: 1150 })))).toBe("€17.69 /m²");
    expect(plain(formatRentPerM2(item({ askingColdRent: 950.5 }, { areaM2: 58 })))).toBe("€16.39 /m²");
  });

  it("formats rents as entered: whole euros, or with cents", () => {
    expect(formatRent(1150)).toBe("€1,150");
    expect(formatRent(1150.5)).toBe("€1,150.50");
  });

  it("names a property by its most specific place and area", () => {
    expect(plain(defaultLabelFor(item().property, names))).toBe("Moabit, 65 m²");
    expect(plain(defaultLabelFor(item({}, { bezirkCode: "04", ortsteilCode: null, areaM2: 82.5 }).property, names))).toBe(
      "Charlottenburg-Wilmersdorf, 82.5 m²",
    );
    expect(defaultCompareLabel("x".repeat(80), 65)).toHaveLength(60);
  });

  it("shows a listing by its host", () => {
    expect(listingHost("https://www.immobilienscout24.de/expose/123")).toBe("immobilienscout24.de");
    expect(listingHost("http://example.org:8080/a")).toBe("example.org");
  });
});
