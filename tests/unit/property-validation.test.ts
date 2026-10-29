import { getBezirkOptions, getOrtsteilOptions } from "@/lib/data/geo";
import {
  createPropertySchema,
  EMPTY_PROPERTY_FORM,
  isAnswered,
  parseDecimal,
  type PropertyFormValues,
} from "@/lib/validation/property";

const schema = createPropertySchema(getBezirkOptions(), getOrtsteilOptions());

const minimal: PropertyFormValues = {
  ...EMPTY_PROPERTY_FORM,
  bezirk: "01",
  propertyType: "apartment",
  area: "65",
  rooms: "2,5",
};

function issuesFor(values: PropertyFormValues) {
  const result = schema.safeParse(values);
  if (result.success) return {};
  return Object.fromEntries(result.error.issues.map((i) => [i.path.join("."), i.message]));
}

describe("parseDecimal", () => {
  it.each([
    ["65", 65],
    ["65.5", 65.5],
    ["65,5", 65.5],
    [" 2,5 ", 2.5],
    ["-1", -1],
  ])("parses %j", (raw, n) => expect(parseDecimal(raw)).toBe(n));

  it.each(["", "abc", "1e3", "65 m²", "1,2,3", "0x10"])("rejects %j", (raw) => {
    expect(parseDecimal(raw)).toBeNaN();
  });
});

describe("property schema", () => {
  it("accepts the four required fields and maps the rest to unknown/null", () => {
    const result = schema.parse(minimal);
    expect(result).toEqual({
      bezirkCode: "01",
      ortsteilCode: null,
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
    });
  });

  it("explains each missing required field", () => {
    const issues = issuesFor(EMPTY_PROPERTY_FORM);
    expect(issues.bezirk).toMatch(/Bezirk/);
    expect(issues.propertyType).toMatch(/property type/);
    expect(issues.area).toBe("Enter the living area in m², for example 65.");
    expect(issues.rooms).toMatch(/number of rooms/);
  });

  it("does not treat an empty number as zero", () => {
    expect(issuesFor({ ...minimal, area: "" }).area).toMatch(/Enter the living area/);
    expect(issuesFor({ ...minimal, area: "0" }).area).toMatch(/between 10 and 500/);
  });

  it("enforces half-room steps and whole floors", () => {
    expect(issuesFor({ ...minimal, rooms: "2.3" }).rooms).toMatch(/steps of 0.5/);
    expect(issuesFor({ ...minimal, floor: "1.5" }).floor).toMatch(/whole number/);
  });

  it("checks that the Ortsteil belongs to the chosen Bezirk", () => {
    // 0801 = Neukölln, in Bezirk 08, not Mitte (01).
    const issues = issuesFor({ ...minimal, ortsteil: "0801" });
    expect(issues.ortsteil).toBe(
      "Neukölln is in Neukölln, not Mitte. Choose an Ortsteil in Mitte or change the Bezirk.",
    );
    expect(schema.parse({ ...minimal, ortsteil: "0102" }).ortsteilCode).toBe("0102");
  });

  it("rejects a floor above the building", () => {
    const issues = issuesFor({ ...minimal, floor: "7", totalFloors: "5" });
    expect(issues.floor).toMatch(/Floor 7 is above the building's 5 floors/);
    expect(schema.parse({ ...minimal, floor: "0", totalFloors: "5" }).floor).toBe(0);
  });

  it("reports cross-field problems while other required fields are still empty", () => {
    const issues = issuesFor({ ...EMPTY_PROPERTY_FORM, bezirk: "03", ortsteil: "0102", floor: "7", totalFloors: "5" });
    expect(issues.floor).toMatch(/Floor 7 is above the building's 5 floors/);
    expect(issues.ortsteil).toMatch(/Moabit is in Mitte, not Pankow/);
    expect(issues.area).toBeDefined();
  });

  it("skips a cross-field rule while one of its own fields is invalid", () => {
    const issues = issuesFor({ ...minimal, floor: "abc", totalFloors: "5" });
    expect(issues.floor).toMatch(/must be a number/);
  });

  it("maps tri-states to booleans and keeps 'not sure' as null", () => {
    const result = schema.parse({ ...minimal, lift: "yes", balcony: "no" });
    expect(result.hasLift).toBe(true);
    expect(result.hasBalcony).toBe(false);
  });
});

describe("isAnswered", () => {
  it("does not count 'Not sure' or blanks as answers", () => {
    expect(isAnswered("bezirk", minimal)).toBe(true);
    expect(isAnswered("floor", minimal)).toBe(false);
    expect(isAnswered("lift", minimal)).toBe(false);
    expect(isAnswered("lift", { ...minimal, lift: "no" })).toBe(true);
  });
});
