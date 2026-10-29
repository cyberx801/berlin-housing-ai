// The four dashboard modules and the endpoint each one reads (D-022, D-040). A module only lists
// the filter fields it uses, so a change elsewhere doesn't refetch it.
import { apiSearch, type MarketApiField, type MarketFilter } from "@/lib/market/query";
import { districtsSchema, histogramSchema, responseSchema, trendSchema, typesSchema } from "@/lib/market/schemas";
import type { DistrictValue, MarketResponse, PriceHistogram, TrendResult, TypeValue } from "@/types/market";
import type { z } from "zod";

export interface ModuleSpec<T> {
  path: string;
  fields: readonly MarketApiField[];
  schema: z.ZodType<MarketResponse<T>>;
}

export const MODULES = {
  trend: {
    path: "/api/market/rent-trend",
    fields: ["bezirke", "period", "type"],
    schema: responseSchema(trendSchema),
  } satisfies ModuleSpec<TrendResult>,
  districts: {
    path: "/api/market/districts",
    fields: ["period", "type"],
    schema: responseSchema(districtsSchema),
  } satisfies ModuleSpec<DistrictValue[]>,
  distribution: {
    path: "/api/market/distribution",
    fields: ["bezirke", "period", "type"],
    schema: responseSchema(histogramSchema),
  } satisfies ModuleSpec<PriceHistogram>,
  types: {
    path: "/api/market/property-types",
    fields: ["bezirke", "period"],
    schema: responseSchema(typesSchema),
  } satisfies ModuleSpec<TypeValue[]>,
};

export interface InitialMarketData {
  trend: MarketResponse<TrendResult>;
  districts: MarketResponse<DistrictValue[]>;
  distribution: MarketResponse<PriceHistogram>;
  types: MarketResponse<TypeValue[]>;
}

export function moduleSearch(spec: { fields: readonly MarketApiField[] }, filter: MarketFilter): string {
  return apiSearch(filter, spec.fields);
}

export async function fetchModule<T>(spec: ModuleSpec<T>, search: string, signal: AbortSignal): Promise<MarketResponse<T>> {
  const response = await fetch(`${spec.path}?${search}`, { signal, headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const parsed = spec.schema.safeParse(await response.json());
  if (!parsed.success) throw new Error("INVALID_RESPONSE");
  return parsed.data;
}
