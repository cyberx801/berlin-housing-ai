import "server-only";
import { z } from "zod";
import type { Provenance } from "@/types/provenance";
import zensusJson from "./generated/zensus-rent.json";

// Average net cold rent per Ortsteil from the Zensus 2022 grid, aggregated by scripts/build-zensus-rent.mjs
// (DATA_BOUNDARIES §9, D-062). Validated on load so a broken build output fails loudly.
const schema = z.object({
  sourceId: z.literal("zensus-2022-rent-grid"),
  label: z.string(),
  attribution: z.string(),
  license: z.literal("dl-de/by-2.0"),
  referenceDate: z.iso.date(),
  retrieved: z.iso.date(),
  minDwellings: z.number().int().positive(),
  berlin: z.object({ meanRentPerM2: z.number().positive(), dwellings: z.number().int().positive(), cells: z.number().int() }),
  ortsteile: z
    .array(
      z.object({
        code: z.string().regex(/^\d{4}$/),
        name: z.string(),
        cells: z.number().int().nonnegative(),
        dwellings: z.number().int().nonnegative(),
        flaggedShare: z.number().min(0).max(1),
        meanRentPerM2: z.number().positive().nullable(),
      }),
    )
    .length(97),
});

const data = schema.parse(zensusJson);
const byCode = new Map(data.ortsteile.map((o) => [o.code, o]));

export const ZENSUS_PROVENANCE: Provenance = {
  kind: "official",
  sourceId: data.sourceId,
  label: "Zensus 2022 (Statistische Ämter des Bundes und der Länder)",
  license: data.license,
  retrieved: data.retrieved,
};

export interface OrtsteilRent {
  /** Weighted mean of the cells' average net cold rent, €/m². Null where too few flats stand behind it. */
  meanRentPerM2: number | null;
  /** Rented flats behind the figure. */
  dwellings: number;
  /** Share of those flats in cells the statistical offices flag as statistically uncertain. */
  flaggedShare: number;
}

export const ZENSUS_RENT_META = {
  referenceDate: data.referenceDate,
  attribution: data.attribution,
  minDwellings: data.minDwellings,
  berlinMeanRentPerM2: data.berlin.meanRentPerM2,
  berlinDwellings: data.berlin.dwellings,
};

export function getOrtsteilRent(code: string): OrtsteilRent | undefined {
  const o = byCode.get(code);
  return o && { meanRentPerM2: o.meanRentPerM2, dwellings: o.dwellings, flaggedShare: o.flaggedShare };
}
