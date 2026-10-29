import { FIELD_GROUPS, type FieldGroup, type PropertyFormValues } from "@/lib/validation/property";

export type FormField = keyof PropertyFormValues;

/** Element ids are `analyze-<field>`; routes stay mounted while hidden, so the prefix is page-unique. */
export const ANALYZE_ID = "analyze";
export const fieldId = (field: FormField) => `${ANALYZE_ID}-${field}`;

export const FIELD_ORDER = Object.values(FIELD_GROUPS).flat() as FormField[];

export const FIELD_LABELS: Record<FormField, string> = {
  bezirk: "Bezirk (borough)",
  ortsteil: "Ortsteil",
  address: "Address or landmark",
  propertyType: "Property type",
  area: "Living area",
  rooms: "Rooms",
  floor: "Floor",
  totalFloors: "Total floors",
  buildingEra: "Building era",
  energyClass: "Energy class",
  condition: "Condition",
  lift: "Lift",
  balcony: "Balcony",
  furnishing: "Furnishing",
  transitMinutes: "Walk to U-Bahn or S-Bahn",
};

/** Fields rendered as radio groups: error links point at a radio, not the fieldset. */
export const RADIO_FIELDS = new Set<FormField>(["propertyType", "condition", "lift", "balcony", "furnishing"]);

export const SECTIONS: { key: FieldGroup; title: string }[] = [
  { key: "location", title: "Location" },
  { key: "flat", title: "The flat" },
  { key: "building", title: "Building" },
  { key: "features", title: "Features" },
  { key: "surroundings", title: "Surroundings" },
];

export const sectionId = (key: FieldGroup) => `${ANALYZE_ID}-section-${key}`;

/** Contract v1 field names (PREDICTION_API.md §2) → form fields, for errors the model reports. */
const WIRE_TO_FORM: Record<string, FormField> = {
  bezirk: "bezirk",
  ortsteil: "ortsteil",
  ortsteil_code: "ortsteil",
  property_type: "propertyType",
  rooms: "rooms",
  area_m2: "area",
  floor: "floor",
  total_floors: "totalFloors",
  building_era: "buildingEra",
  energy_class: "energyClass",
  condition: "condition",
  has_lift: "lift",
  has_balcony: "balcony",
  furnishing: "furnishing",
  transit_distance_min: "transitMinutes",
};

/** Accepts "area_m2", "body.area_m2" or a FastAPI `loc` tail. Unknown names return null. */
export function formFieldForWire(field: string): FormField | null {
  const name = field.split(".").at(-1) ?? "";
  return Object.hasOwn(WIRE_TO_FORM, name) ? (WIRE_TO_FORM[name] ?? null) : null;
}

/** A stable fingerprint of the form values, independent of key order. */
export function fingerprint(values: Partial<PropertyFormValues>): string {
  return FIELD_ORDER.map((field) => values[field] ?? "").join("\u001f");
}
