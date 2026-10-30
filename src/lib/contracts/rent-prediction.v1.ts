/**
 * Rent prediction API — contract v1, DRAFT 2 (docs/contracts/PREDICTION_API.md).
 * The first model is a demo trained on synthetic data (D-058): a response without
 * `model.training_data.synthetic` is never shown as an estimate (see interpret.ts).
 * The frontend ships with prediction disabled.
 */
import { z } from "zod";
import {
  BUILDING_ERAS,
  CONDITIONS,
  ENERGY_CLASSES,
  FURNISHINGS,
  LIMITS,
  PROPERTY_TYPES,
  UNKNOWN,
} from "@/lib/property/enums";
import type { PropertyInput } from "@/lib/validation/property";

export const CONTRACT_VERSION = "1.0-draft.2";
export const API_MAJOR = 1;
export const RENT_PREDICTION_PATH = "/api/v1/predictions/rent";

const BERLIN_BBOX = { latMin: 52.33, latMax: 52.68, lonMin: 13.08, lonMax: 13.77 } as const;

export const rentPredictionRequestV1 = z
  .strictObject({
    bezirk: z.string().min(1),
    ortsteil: z.string().min(1).nullable(),
    ortsteil_code: z
      .string()
      .regex(/^\d{4}$/)
      .nullable(),
    property_type: z.enum(PROPERTY_TYPES),
    rooms: z.number().min(LIMITS.rooms.min).max(LIMITS.rooms.max).multipleOf(LIMITS.rooms.step),
    area_m2: z.number().min(LIMITS.areaM2.min).max(LIMITS.areaM2.max),
    floor: z.number().int().min(LIMITS.floor.min).max(LIMITS.floor.max).nullable(),
    total_floors: z.number().int().min(LIMITS.totalFloors.min).max(LIMITS.totalFloors.max).nullable(),
    building_era: z.enum([...BUILDING_ERAS, UNKNOWN]),
    energy_class: z.enum([...ENERGY_CLASSES, UNKNOWN]),
    condition: z.enum([...CONDITIONS, UNKNOWN]),
    has_lift: z.boolean().nullable(),
    has_balcony: z.boolean().nullable(),
    furnishing: z.enum([...FURNISHINGS, UNKNOWN]),
    transit_distance_min: z
      .number()
      .int()
      .min(LIMITS.transitMinutes.min)
      .max(LIMITS.transitMinutes.max)
      .nullable(),
    lat: z.number().min(BERLIN_BBOX.latMin).max(BERLIN_BBOX.latMax).nullable(),
    lon: z.number().min(BERLIN_BBOX.lonMin).max(BERLIN_BBOX.lonMax).nullable(),
  })
  .refine((r) => (r.lat === null) === (r.lon === null), {
    message: "lat and lon must be provided together",
    path: ["lat"],
  })
  .refine((r) => r.floor === null || r.total_floors === null || r.floor <= r.total_floors, {
    message: "floor must be <= total_floors",
    path: ["floor"],
  });
export type RentPredictionRequestV1 = z.infer<typeof rentPredictionRequestV1>;

const money = z.object({ value: z.number().positive(), currency: z.literal("EUR") });

export const rentPredictionResponseV1 = z.object({
  api_version: z.string().regex(/^1\.\d+/),
  request_id: z.string().min(1),
  generated_at: z.string(),
  estimate: z.object({
    monthly_cold_rent: money,
    rent_per_m2: money.optional(),
    interval: z
      .object({
        lower: z.number().positive(),
        upper: z.number().positive(),
        level: z.number().gt(0).lt(1),
        method: z.string().optional(),
      })
      .refine((i) => i.lower <= i.upper, "interval lower must be <= upper")
      .nullable(),
  }),
  model: z.object({
    name: z.string(),
    version: z.string(),
    trained_at: z.string().optional(),
    training_data: z
      .object({
        source_id: z.string(),
        /** `true`: generated data. Absent: unknown, which the client treats as not connected (D-058). */
        synthetic: z.boolean().optional(),
        reference_period: z.object({ start: z.string(), end: z.string() }).optional(),
      })
      .optional(),
  }),
  data_reference_date: z.string(),
  inputs: z.object({
    missing: z.array(z.string()),
    imputed: z.array(z.object({ field: z.string(), strategy: z.string() })),
    /** Fields that were sent and have no effect on this model. */
    ignored: z.array(z.string()).optional(),
  }),
  warnings: z.array(z.object({ code: z.string(), message: z.string(), field: z.string().optional() })),
  explanation: z
    .object({
      method: z.string(),
      baseline_rent_per_m2: z.number().positive(),
      /** Effect on rent per m² against the average training listing, in percent. */
      factors: z.array(z.object({ feature: z.string(), effect_pct: z.number() })),
    })
    .optional(),
});
export type RentPredictionResponseV1 = z.infer<typeof rentPredictionResponseV1>;

export const errorEnvelopeV1 = z.object({
  api_version: z.string().optional(),
  request_id: z.string().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({ field: z.string(), issue: z.string() })).optional(),
    retryable: z.boolean().optional(),
  }),
});
export type ErrorEnvelopeV1 = z.infer<typeof errorEnvelopeV1>;

/** FastAPI's default 422 body, accepted until the service installs the envelope handler. */
export const fastApiValidationError = z.object({
  detail: z.array(
    z.object({
      loc: z.array(z.union([z.string(), z.number()])),
      msg: z.string(),
      type: z.string().optional(),
    }),
  ),
});

export interface NameLookup {
  bezirkName(code: string): string | undefined;
  ortsteilName(code: string): string | undefined;
}

/**
 * The only mapping from the UI-shaped property input to the wire request.
 * "Not sure" → null / "unknown"; codes → official ALKIS names; no geocoding (lat/lon null).
 */
export function toRentPredictionRequest(input: PropertyInput, names: NameLookup): RentPredictionRequestV1 {
  const bezirk = names.bezirkName(input.bezirkCode);
  if (!bezirk) throw new Error(`Unknown Bezirk code ${input.bezirkCode}`);
  const ortsteil = input.ortsteilCode ? (names.ortsteilName(input.ortsteilCode) ?? null) : null;

  return {
    bezirk,
    ortsteil,
    ortsteil_code: ortsteil ? input.ortsteilCode : null,
    property_type: input.propertyType,
    rooms: input.rooms,
    area_m2: input.areaM2,
    floor: input.floor,
    total_floors: input.totalFloors,
    building_era: input.buildingEra,
    energy_class: input.energyClass,
    condition: input.condition,
    has_lift: input.hasLift,
    has_balcony: input.hasBalcony,
    furnishing: input.furnishing,
    transit_distance_min: input.transitMinutes,
    lat: null,
    lon: null,
  };
}
