import { getBezirkOptions, getOrtsteilOptions } from "@/lib/data/geo";
import {
  createPropertySchema,
  EMPTY_PROPERTY_FORM,
  formValuesSchema,
  storedPropertySchema,
  toFormValues,
  type PropertyInput,
} from "@/lib/validation/property";

const schema = createPropertySchema(getBezirkOptions(), getOrtsteilOptions());

const full: PropertyInput = {
  bezirkCode: "01",
  ortsteilCode: "0102",
  address: "Near Turmstraße",
  propertyType: "apartment",
  areaM2: 65.5,
  rooms: 2.5,
  floor: -1,
  totalFloors: 5,
  buildingEra: "pre_1919",
  energyClass: "C",
  condition: "well_kept",
  hasLift: false,
  hasBalcony: true,
  furnishing: "unfurnished",
  transitMinutes: 0,
};

const sparse: PropertyInput = {
  ...full,
  ortsteilCode: null,
  address: null,
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

describe("toFormValues", () => {
  it.each([
    ["every field given", full],
    ["only required fields", sparse],
  ])("round-trips through the form schema (%s)", (_name, input) => {
    expect(schema.parse(toFormValues(input))).toEqual(input);
  });

  it("maps null and unknown back to the form's empty and Not sure states", () => {
    const values = toFormValues(sparse);
    expect(values).toMatchObject({ ortsteil: "", floor: "", lift: "unknown", balcony: "unknown", transitMinutes: "" });
  });
});

describe("storedPropertySchema", () => {
  it("accepts a parsed property", () => {
    expect(storedPropertySchema.safeParse(full).success).toBe(true);
  });

  it.each([
    ["an unknown Bezirk code", { bezirkCode: "13" }],
    ["rooms off the half step", { rooms: 2.25 }],
    ["a floor that is not a whole number", { floor: 1.5 }],
    ["a boolean stored as text", { hasLift: "yes" }],
    ["an area out of range", { areaM2: 9 }],
  ])("rejects %s", (_name, patch) => {
    expect(storedPropertySchema.safeParse({ ...full, ...patch }).success).toBe(false);
  });
});

describe("formValuesSchema (session draft)", () => {
  it("accepts the empty form and partial input", () => {
    expect(formValuesSchema.safeParse(EMPTY_PROPERTY_FORM).success).toBe(true);
    expect(formValuesSchema.safeParse({ ...EMPTY_PROPERTY_FORM, area: "6", rooms: "abc" }).success).toBe(true);
  });

  it("rejects a draft with a missing field or an unknown option", () => {
    const missing: Partial<typeof EMPTY_PROPERTY_FORM> = { ...EMPTY_PROPERTY_FORM };
    delete missing.area;
    expect(formValuesSchema.safeParse(missing).success).toBe(false);
    expect(formValuesSchema.safeParse({ ...EMPTY_PROPERTY_FORM, lift: "maybe" }).success).toBe(false);
  });
});
