import { z } from "zod";
import {
  BUILDING_ERAS,
  CONDITIONS,
  ENERGY_CLASSES,
  FURNISHINGS,
  LIMITS,
  PROPERTY_TYPES,
  TRI_STATES,
  UNKNOWN,
  type BuildingEra,
  type Condition,
  type EnergyClass,
  type Furnishing,
  type PropertyType,
  type TriState,
  type Unknown,
} from "@/lib/property/enums";
import type { BezirkOption, OrtsteilOption } from "@/types/geo";

/** Raw form values. Number inputs stay strings until parsed, so empty ≠ 0. */
export interface PropertyFormValues {
  bezirk: string;
  ortsteil: string;
  address: string;
  propertyType: PropertyType | "";
  area: string;
  rooms: string;
  floor: string;
  totalFloors: string;
  buildingEra: BuildingEra | Unknown;
  energyClass: EnergyClass | Unknown;
  condition: Condition | Unknown;
  lift: TriState;
  balcony: TriState;
  furnishing: Furnishing | Unknown;
  transitMinutes: string;
}

/** Parsed, validated property description (UI-shaped; mapped once to the wire contract). */
export interface PropertyInput {
  bezirkCode: string;
  ortsteilCode: string | null;
  address: string | null;
  propertyType: PropertyType;
  areaM2: number;
  rooms: number;
  floor: number | null;
  totalFloors: number | null;
  buildingEra: BuildingEra | Unknown;
  energyClass: EnergyClass | Unknown;
  condition: Condition | Unknown;
  hasLift: boolean | null;
  hasBalcony: boolean | null;
  furnishing: Furnishing | Unknown;
  transitMinutes: number | null;
}

export const EMPTY_PROPERTY_FORM: PropertyFormValues = {
  bezirk: "",
  ortsteil: "",
  address: "",
  propertyType: "",
  area: "",
  rooms: "",
  floor: "",
  totalFloors: "",
  buildingEra: UNKNOWN,
  energyClass: UNKNOWN,
  condition: UNKNOWN,
  lift: UNKNOWN,
  balcony: UNKNOWN,
  furnishing: UNKNOWN,
  transitMinutes: "",
};

export const REQUIRED_FIELDS = ["bezirk", "propertyType", "area", "rooms"] as const;

export const FIELD_GROUPS = {
  location: ["bezirk", "ortsteil", "address"],
  flat: ["propertyType", "area", "rooms", "floor", "totalFloors"],
  building: ["buildingEra", "energyClass", "condition", "lift"],
  features: ["balcony", "furnishing"],
  surroundings: ["transitMinutes"],
} as const satisfies Record<string, readonly (keyof PropertyFormValues)[]>;

export type FieldGroup = keyof typeof FIELD_GROUPS;

/** Parses "65", "65.5" and the German "65,5". Returns NaN for anything else. */
export function parseDecimal(raw: string): number {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}

interface NumberRule {
  label: string;
  min: number;
  max: number;
  unit?: string;
  integer?: boolean;
  step?: number;
  example: string;
}

function numberProblem(n: number, rule: NumberRule): string | null {
  const unit = rule.unit ? ` ${rule.unit}` : "";
  if (!Number.isFinite(n)) return `${rule.label} must be a number, for example ${rule.example}.`;
  if (rule.integer && !Number.isInteger(n)) return `${rule.label} must be a whole number.`;
  if (rule.step && !Number.isInteger(Math.round((n / rule.step) * 1e9) / 1e9)) {
    return `${rule.label} go in steps of ${rule.step}, for example ${rule.example}.`;
  }
  if (n < rule.min || n > rule.max) {
    return `${rule.label} must be between ${rule.min} and ${rule.max}${unit}.`;
  }
  return null;
}

function requiredNumber(rule: NumberRule & { missing: string }) {
  return z.string().transform((raw, ctx): number => {
    if (raw.trim() === "") {
      ctx.addIssue({ code: "custom", message: rule.missing });
      return z.NEVER;
    }
    const n = parseDecimal(raw);
    const problem = numberProblem(n, rule);
    if (problem) {
      ctx.addIssue({ code: "custom", message: problem });
      return z.NEVER;
    }
    return n;
  });
}

function optionalNumber(rule: NumberRule) {
  return z.string().transform((raw, ctx): number | null => {
    if (raw.trim() === "") return null;
    const n = parseDecimal(raw);
    const problem = numberProblem(n, rule);
    if (problem) {
      ctx.addIssue({ code: "custom", message: problem });
      return z.NEVER;
    }
    return n;
  });
}

const triToBool = (v: TriState): boolean | null => (v === "yes" ? true : v === "no" ? false : null);

export const areaField = requiredNumber({
  label: "Living area",
  ...LIMITS.areaM2,
  unit: "m²",
  example: "65",
  missing: "Enter the living area in m², for example 65.",
});

export const roomsField = requiredNumber({
  label: "Rooms",
  min: LIMITS.rooms.min,
  max: LIMITS.rooms.max,
  step: LIMITS.rooms.step,
  example: "2.5",
  missing: "Enter the number of rooms, for example 2 or 2.5.",
});

const BEZIRK_MISSING = "Choose the Bezirk (borough) the flat is in.";

/** For `when`: true if none of the named fields has an issue yet. */
const fieldsValid =
  (...fields: string[]) =>
  (payload: { issues: readonly { path?: readonly PropertyKey[] | undefined }[] }) =>
    !payload.issues.some((issue) => fields.includes(String(issue.path?.[0])));

/**
 * The homepage's short entry (Bezirk, area, rooms). Same rules and messages as `/analyze`;
 * the Bezirk is a slug because the values go straight into the `/analyze` URL (D-030).
 */
export function createAnalysisEntrySchema(bezirke: readonly BezirkOption[]) {
  const slugs = new Set(bezirke.map((b) => b.slug));
  return z.object({
    bezirk: z.string().refine((v) => slugs.has(v), { message: BEZIRK_MISSING }),
    area: areaField,
    rooms: roomsField,
  });
}

/**
 * Builds the property schema against the real Bezirk/Ortsteil lists, so membership
 * ("Moabit is in Mitte") is validated rather than assumed.
 */
export function createPropertySchema(bezirke: readonly BezirkOption[], ortsteile: readonly OrtsteilOption[]) {
  const bezirkByCode = new Map(bezirke.map((b) => [b.code, b]));
  const ortsteilByCode = new Map(ortsteile.map((o) => [o.code, o]));

  return z
    .object({
      // Type errors get the field's own message too, so a stray null never shows Zod's wording.
      bezirk: z.string({ error: BEZIRK_MISSING }).refine((v) => bezirkByCode.has(v), { message: BEZIRK_MISSING }),
      ortsteil: z
        .string({ error: "Choose an Ortsteil from the list." })
        .refine((v) => v === "" || ortsteilByCode.has(v), { message: "Choose an Ortsteil from the list." })
        .transform((v) => (v === "" ? null : v)),
      address: z
        .string()
        .max(LIMITS.address.max, `Keep the address note under ${LIMITS.address.max} characters.`)
        .transform((v) => (v.trim() === "" ? null : v.trim())),
      propertyType: z
        .string({ error: "Choose the property type." })
        .refine((v): v is PropertyType => (PROPERTY_TYPES as readonly string[]).includes(v), {
          message: "Choose the property type.",
        })
        .transform((v) => v as PropertyType),
      area: areaField,
      rooms: roomsField,
      floor: optionalNumber({ label: "Floor", ...LIMITS.floor, integer: true, example: "2" }),
      totalFloors: optionalNumber({
        label: "Total floors",
        ...LIMITS.totalFloors,
        integer: true,
        example: "5",
      }),
      buildingEra: z.enum([...BUILDING_ERAS, UNKNOWN]),
      energyClass: z.enum([...ENERGY_CLASSES, UNKNOWN]),
      condition: z.enum([...CONDITIONS, UNKNOWN]),
      lift: z.enum(TRI_STATES),
      balcony: z.enum(TRI_STATES),
      furnishing: z.enum([...FURNISHINGS, UNKNOWN]),
      transitMinutes: optionalNumber({
        label: "Walking time",
        ...LIMITS.transitMinutes,
        unit: "minutes",
        integer: true,
        example: "8",
      }),
    })
    // Cross-field rules. Zod skips object refinements while any field has an issue, which would
    // hide these until every required field is filled; `when` runs each one as soon as the
    // fields it compares are valid themselves.
    .superRefine(
      (v, ctx) => {
        if (!v.ortsteil) return;
        const o = ortsteilByCode.get(v.ortsteil);
        const b = bezirkByCode.get(v.bezirk);
        if (o && b && o.bezirkCode !== b.code) {
          const actual = bezirkByCode.get(o.bezirkCode)?.name ?? "another Bezirk";
          ctx.addIssue({
            code: "custom",
            path: ["ortsteil"],
            message: `${o.name} is in ${actual}, not ${b.name}. Choose an Ortsteil in ${b.name} or change the Bezirk.`,
          });
        }
      },
      { when: fieldsValid("bezirk", "ortsteil") },
    )
    .superRefine(
      (v, ctx) => {
        if (v.floor !== null && v.totalFloors !== null && v.floor > v.totalFloors) {
          ctx.addIssue({
            code: "custom",
            path: ["floor"],
            message: `Floor ${v.floor} is above the building's ${v.totalFloors} floors. Lower the floor or raise total floors.`,
          });
        }
      },
      { when: fieldsValid("floor", "totalFloors") },
    )
    .transform(
      (v): PropertyInput => ({
        bezirkCode: v.bezirk,
        ortsteilCode: v.ortsteil,
        address: v.address,
        propertyType: v.propertyType,
        areaM2: v.area,
        rooms: v.rooms,
        floor: v.floor,
        totalFloors: v.totalFloors,
        buildingEra: v.buildingEra,
        energyClass: v.energyClass,
        condition: v.condition,
        hasLift: triToBool(v.lift),
        hasBalcony: triToBool(v.balcony),
        furnishing: v.furnishing,
        transitMinutes: v.transitMinutes,
      }),
    );
}

export type PropertySchema = ReturnType<typeof createPropertySchema>;

/** A parsed `PropertyInput` as kept in browser storage (compare store). Validated on every read. */
export const storedPropertySchema: z.ZodType<PropertyInput> = z.object({
  bezirkCode: z.string().regex(/^(0[1-9]|1[0-2])$/),
  ortsteilCode: z
    .string()
    .regex(/^\d{4}$/)
    .nullable(),
  address: z.string().max(LIMITS.address.max).nullable(),
  propertyType: z.enum(PROPERTY_TYPES),
  areaM2: z.number().min(LIMITS.areaM2.min).max(LIMITS.areaM2.max),
  rooms: z.number().min(LIMITS.rooms.min).max(LIMITS.rooms.max).multipleOf(LIMITS.rooms.step),
  floor: z.number().int().min(LIMITS.floor.min).max(LIMITS.floor.max).nullable(),
  totalFloors: z.number().int().min(LIMITS.totalFloors.min).max(LIMITS.totalFloors.max).nullable(),
  buildingEra: z.enum([...BUILDING_ERAS, UNKNOWN]),
  energyClass: z.enum([...ENERGY_CLASSES, UNKNOWN]),
  condition: z.enum([...CONDITIONS, UNKNOWN]),
  hasLift: z.boolean().nullable(),
  hasBalcony: z.boolean().nullable(),
  furnishing: z.enum([...FURNISHINGS, UNKNOWN]),
  transitMinutes: z.number().int().min(LIMITS.transitMinutes.min).max(LIMITS.transitMinutes.max).nullable(),
});

const boolToTri = (v: boolean | null): TriState => (v === true ? "yes" : v === false ? "no" : UNKNOWN);
const numToField = (v: number | null) => (v === null ? "" : String(v));

/** The inverse of the schema's transform, for editing a stored property in a form. */
export function toFormValues(input: PropertyInput): PropertyFormValues {
  return {
    bezirk: input.bezirkCode,
    ortsteil: input.ortsteilCode ?? "",
    address: input.address ?? "",
    propertyType: input.propertyType,
    area: String(input.areaM2),
    rooms: String(input.rooms),
    floor: numToField(input.floor),
    totalFloors: numToField(input.totalFloors),
    buildingEra: input.buildingEra,
    energyClass: input.energyClass,
    condition: input.condition,
    lift: boolToTri(input.hasLift),
    balcony: boolToTri(input.hasBalcony),
    furnishing: input.furnishing,
    transitMinutes: numToField(input.transitMinutes),
  };
}

/** Raw form values as kept in the session draft. Shape-checked only; the form validates content. */
export const formValuesSchema: z.ZodType<PropertyFormValues> = z.object({
  bezirk: z.string().max(4),
  ortsteil: z.string().max(4),
  address: z.string().max(LIMITS.address.max * 2),
  propertyType: z.union([z.enum(PROPERTY_TYPES), z.literal("")]),
  area: z.string().max(12),
  rooms: z.string().max(12),
  floor: z.string().max(12),
  totalFloors: z.string().max(12),
  buildingEra: z.enum([...BUILDING_ERAS, UNKNOWN]),
  energyClass: z.enum([...ENERGY_CLASSES, UNKNOWN]),
  condition: z.enum([...CONDITIONS, UNKNOWN]),
  lift: z.enum(TRI_STATES),
  balcony: z.enum(TRI_STATES),
  furnishing: z.enum([...FURNISHINGS, UNKNOWN]),
  transitMinutes: z.string().max(12),
});

/** Whether a raw form value counts as "answered" for progress display. */
export function isAnswered(field: keyof PropertyFormValues, values: PropertyFormValues): boolean {
  const v = values[field];
  if (typeof v !== "string") return false;
  return v.trim() !== "" && v !== UNKNOWN;
}
