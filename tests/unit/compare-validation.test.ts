import { compareItemSchema } from "@/features/property-comparison/store";
import { createCompareExtrasSchema, EMPTY_COMPARE_EXTRAS, parseEuroAmount, rentToField } from "@/lib/validation/compare";
import type { PropertyInput } from "@/lib/validation/property";

const property: PropertyInput = {
  bezirkCode: "01",
  ortsteilCode: "0102",
  address: null,
  propertyType: "apartment",
  areaM2: 65,
  rooms: 2.5,
  floor: null,
  totalFloors: null,
  buildingEra: "unknown",
  energyClass: "unknown",
  condition: "unknown",
  hasLift: null,
  hasBalcony: null,
  furnishing: "unknown",
  transitMinutes: null,
};

const extras = (values: Partial<typeof EMPTY_COMPARE_EXTRAS>, replaceIds: string[] = []) =>
  createCompareExtrasSchema(replaceIds).safeParse({ ...EMPTY_COMPARE_EXTRAS, ...values });

const messages = (result: ReturnType<typeof extras>) => (result.success ? [] : result.error.issues.map((i) => i.message));

describe("parseEuroAmount", () => {
  it.each([
    ["1150", 1150],
    ["1.150", 1150],
    ["1,150", 1150],
    ["950,50", 950.5],
    ["950.5", 950.5],
    ["1.150,50", 1150.5],
    ["1,150.50", 1150.5],
    ["1.150.000", 1_150_000],
    ["€1,150", 1150],
    ["1150 €", 1150],
    ["1 150", 1150],
    ["1 150,00 EUR", 1150],
    ["0", 0],
  ])("reads %s as %d", (raw, value) => {
    expect(parseEuroAmount(raw)).toBe(value);
  });

  it.each(["", "abc", "1.15.0", "1,150,50", "1.150.50", "1234.567", "-950", "12,345.678", "1e3", "€"])(
    "rejects %j",
    (raw) => {
      expect(parseEuroAmount(raw)).toBeNaN();
    },
  );

  it("reads a stored rent back from its form text", () => {
    expect(parseEuroAmount(rentToField(1150.5))).toBe(1150.5);
    expect(parseEuroAmount(rentToField(1150))).toBe(1150);
    expect(rentToField(null)).toBe("");
  });
});

describe("compare dialog extras", () => {
  it("treats every listing field as optional", () => {
    expect(extras({})).toEqual({
      success: true,
      data: { label: null, askingColdRent: null, listingUrl: null, replace: null },
    });
  });

  it("trims the name and limits it to 60 characters", () => {
    expect(extras({ label: "  Turmstraße  " }).data?.label).toBe("Turmstraße");
    expect(messages(extras({ label: "x".repeat(61) }))).toEqual(["Keep the name under 60 characters."]);
    expect(extras({ label: `  ${"x".repeat(60)}  ` }).success).toBe(true);
  });

  it("names the fix for a rent that isn't an amount or is out of range", () => {
    expect(extras({ askingColdRent: "1.150,50" }).data?.askingColdRent).toBe(1150.5);
    expect(messages(extras({ askingColdRent: "about 1000" }))).toEqual([
      "Enter the asking cold rent in euros, for example 1150 or 1.150,50.",
    ]);
    expect(messages(extras({ askingColdRent: "0" }))).toEqual([
      "The asking cold rent must be between €1 and €100,000 a month.",
    ]);
    expect(messages(extras({ askingColdRent: "100.000,01" }))).toHaveLength(1);
  });

  it.each(["javascript:alert(1)", "ftp://example.org/x", "data:text/html,hi", "www.example.org/x", "example"])(
    "rejects the link %j",
    (listingUrl) => {
      expect(messages(extras({ listingUrl }))).toEqual(["Paste the listing's full web address, starting with https://."]);
    },
  );

  it("keeps http(s) links as entered and limits their length", () => {
    expect(extras({ listingUrl: " https://www.example.org/expose/1?x=2 " }).data?.listingUrl).toBe(
      "https://www.example.org/expose/1?x=2",
    );
    expect(extras({ listingUrl: "http://example.org" }).success).toBe(true);
    expect(messages(extras({ listingUrl: `https://example.org/${"a".repeat(490)}` }))).toEqual([
      "This link is longer than 500 characters. Copy a shorter link to the listing.",
    ]);
  });

  it("asks which property to replace only when the comparison is full", () => {
    expect(extras({ replace: "a" }).data?.replace).toBeNull();
    expect(messages(extras({}, ["a", "b", "c"]))).toEqual(["Choose the property this one replaces."]);
    expect(messages(extras({ replace: "gone" }, ["a", "b", "c"]))).toEqual(["Choose the property this one replaces."]);
    expect(extras({ replace: "b" }, ["a", "b", "c"]).data?.replace).toBe("b");
  });

  it("only lets through values the stored comparison accepts, so saving can't throw", () => {
    const cases = [
      { label: "x".repeat(60), askingColdRent: "100.000", listingUrl: `https://example.org/${"a".repeat(480)}` },
      { label: "", askingColdRent: "1", listingUrl: "http://example.org" },
      { label: " Kiez ", askingColdRent: "", listingUrl: "" },
    ];
    for (const values of cases) {
      const parsed = extras(values);
      expect(parsed.success).toBe(true);
      const item = {
        id: "id-1",
        label: parsed.data!.label ?? "Moabit, 65 m²",
        property,
        askingColdRent: parsed.data!.askingColdRent,
        listingUrl: parsed.data!.listingUrl,
        source: "manual",
        addedAt: "2026-10-29T10:00:00.000Z",
      };
      expect(compareItemSchema.safeParse(item).success).toBe(true);
    }
  });
});
