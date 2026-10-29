// Response schemas for /api/market/*. The dashboard parses every response; one that doesn't
// parse is treated as a failed module, never rendered half-read.
import { z } from "zod";
import type { Provenance } from "@/types/provenance";
import {
  MARKET_TYPES,
  type DistrictValue,
  type MarketResponse,
  type PriceHistogram,
  type TrendResult,
  type TypeValue,
} from "@/types/market";

export const provenanceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("official"),
    sourceId: z.string(),
    label: z.string(),
    license: z.string(),
    retrieved: z.string(),
  }),
  z.object({
    kind: z.literal("research"),
    sourceId: z.string(),
    label: z.string(),
    validation: z.enum(["pending", "passed", "failed"]),
  }),
  z.object({ kind: z.literal("demo"), fixtureId: z.string(), note: z.string() }),
  z.object({ kind: z.literal("user") }),
  z.object({ kind: z.literal("model"), modelVersion: z.string(), dataReferenceDate: z.string() }),
  z.object({ kind: z.literal("not-connected"), missing: z.string() }),
  z.object({ kind: z.literal("pending"), reason: z.string() }),
]) satisfies z.ZodType<Provenance>;

const euroPerM2 = z.number().finite().nonnegative();
const count = z.number().int().nonnegative();

export const trendSchema = z.object({
  firstMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  series: z.array(z.object({ key: z.string(), values: z.array(euroPerM2.nullable()) })),
  missing: z.array(z.string()),
}) satisfies z.ZodType<TrendResult>;

export const districtsSchema = z.array(
  z.object({ code: z.string(), median: euroPerM2.nullable(), listings: count }),
) satisfies z.ZodType<DistrictValue[]>;

export const histogramSchema = z.object({
  binMin: euroPerM2,
  binWidth: z.number().positive(),
  counts: z.array(count),
  total: count,
  median: euroPerM2.nullable(),
}) satisfies z.ZodType<PriceHistogram>;

export const typesSchema = z.array(
  z.object({
    type: z.enum(MARKET_TYPES),
    listings: count,
    median: euroPerM2.nullable(),
    q1: euroPerM2.nullable(),
    q3: euroPerM2.nullable(),
  }),
) satisfies z.ZodType<TypeValue[]>;

export function responseSchema<T>(data: z.ZodType<T>): z.ZodType<MarketResponse<T>> {
  return z.object({ provenance: provenanceSchema, data });
}
