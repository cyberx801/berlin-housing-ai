import "server-only";
import { z } from "zod";
import fixtureJson from "@/lib/fixtures/demo/market-v1.json";
import { MARKET_TYPES, type MarketType, type MarketTypeFilter } from "@/types/market";
import type { Provenance } from "@/types/provenance";
import type { MarketDataSource } from "./source";

// The only module allowed to read demo fixtures (DATA_BOUNDARIES §5). The file is validated on
// load so a broken regeneration fails loudly instead of drawing nonsense.
const BEZIRK_CODES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;
const AREA_KEYS = [...BEZIRK_CODES, "berlin"] as const;
const TYPE_KEYS = [...MARKET_TYPES, "all"] as const;

const monthlySchema = z.object({
  median: z.array(z.number().nonnegative().nullable()),
  listings: z.array(z.number().int().nonnegative()),
});

const fixtureSchema = z.object({
  _provenance: z.object({ kind: z.literal("demo"), fixtureId: z.string(), note: z.string() }),
  firstMonth: z.string().regex(/^\d{4}-01$/),
  lastMonth: z.string().regex(/^\d{4}-12$/),
  types: z.array(z.enum(MARKET_TYPES)).length(MARKET_TYPES.length),
  bins: z.object({ min: z.number(), width: z.number().positive(), count: z.number().int().positive() }),
  monthly: z.record(z.enum(AREA_KEYS), z.record(z.enum(TYPE_KEYS), monthlySchema)),
  yearly: z.record(z.enum(BEZIRK_CODES), z.record(z.enum(MARKET_TYPES), z.array(z.array(z.number().int().nonnegative())))),
});

const FIXTURE = fixtureSchema.parse(fixtureJson);
const FIRST_YEAR = Number(FIXTURE.firstMonth.slice(0, 4));
const LAST_YEAR = Number(FIXTURE.lastMonth.slice(0, 4));
const MONTHS = (LAST_YEAR - FIRST_YEAR + 1) * 12;
const BINS = FIXTURE.bins;

for (const area of AREA_KEYS) {
  for (const type of TYPE_KEYS) {
    const series = FIXTURE.monthly[area][type];
    if (series.median.length !== MONTHS || series.listings.length !== MONTHS) {
      throw new Error(`Demo fixture: monthly.${area}.${type} should have ${MONTHS} months.`);
    }
  }
}
for (const code of BEZIRK_CODES) {
  for (const type of MARKET_TYPES) {
    const perYear = FIXTURE.yearly[code][type];
    if (perYear.length !== LAST_YEAR - FIRST_YEAR + 1 || perYear.some((bins) => bins.length !== BINS.count)) {
      throw new Error(`Demo fixture: yearly.${code}.${type} has the wrong shape.`);
    }
  }
}

const PROVENANCE: Provenance = { ...FIXTURE._provenance };

function isBezirk(code: string): code is (typeof BEZIRK_CODES)[number] {
  return (BEZIRK_CODES as readonly string[]).includes(code);
}

/** Sums the 1 € bins for the given Bezirke (all if empty), types and years. */
function sumBins(bezirke: readonly string[], types: readonly MarketType[], from: number, to: number): number[] {
  const sum = new Array<number>(BINS.count).fill(0);
  const codes = bezirke.length > 0 ? bezirke.filter(isBezirk) : BEZIRK_CODES;
  for (const code of codes) {
    for (const type of types) {
      for (let year = from; year <= to; year += 1) {
        const bins = FIXTURE.yearly[code][type][year - FIRST_YEAR] ?? [];
        bins.forEach((n, i) => {
          sum[i] = (sum[i] ?? 0) + n;
        });
      }
    }
  }
  return sum;
}

/** Quantile read from binned counts, interpolating linearly inside the bin. */
export function binnedQuantile(counts: readonly number[], binMin: number, binWidth: number, p: number): number | null {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  const target = p * total;
  let below = 0;
  for (let i = 0; i < counts.length; i += 1) {
    const n = counts[i] ?? 0;
    if (n > 0 && below + n >= target) {
      return Math.round((binMin + binWidth * (i + (target - below) / n)) * 100) / 100;
    }
    below += n;
  }
  return binMin + binWidth * counts.length;
}

const typesFor = (type: MarketTypeFilter): readonly MarketType[] => (type === "all" ? MARKET_TYPES : [type]);
const resolve = <T>(value: T) => Promise.resolve(value);

export const demoMarketSource: MarketDataSource = {
  provenance: PROVENANCE,
  coverage: { firstYear: FIRST_YEAR, lastYear: LAST_YEAR, types: MARKET_TYPES },

  rentTrend({ bezirke, from, to, type }) {
    const keys = bezirke.length > 0 ? bezirke.filter(isBezirk) : (["berlin"] as const);
    const start = (from - FIRST_YEAR) * 12;
    const end = (to - FIRST_YEAR + 1) * 12;
    const series = keys.map((key) => ({ key, values: FIXTURE.monthly[key][type].median.slice(start, end) }));
    return resolve({
      firstMonth: `${from}-01`,
      series: series.filter((s) => s.values.some((v) => v !== null)),
      missing: series.filter((s) => s.values.every((v) => v === null)).map((s) => s.key),
    });
  },

  districtComparison({ from, to, type }) {
    return resolve(
      BEZIRK_CODES.map((code) => {
        const counts = sumBins([code], typesFor(type), from, to);
        return {
          code,
          median: binnedQuantile(counts, BINS.min, BINS.width, 0.5),
          listings: counts.reduce((a, b) => a + b, 0),
        };
      }),
    );
  },

  priceDistribution({ bezirke, from, to, type }) {
    const fine = sumBins(bezirke, typesFor(type), from, to);
    // Shown in 2 € bins; the median is read from the 1 € bins.
    const counts = Array.from({ length: Math.ceil(fine.length / 2) }, (_, i) => (fine[2 * i] ?? 0) + (fine[2 * i + 1] ?? 0));
    return resolve({
      binMin: BINS.min,
      binWidth: BINS.width * 2,
      counts,
      total: fine.reduce((a, b) => a + b, 0),
      median: binnedQuantile(fine, BINS.min, BINS.width, 0.5),
    });
  },

  propertyTypeComparison({ bezirke, from, to }) {
    return resolve(
      MARKET_TYPES.map((type) => {
        const counts = sumBins(bezirke, [type], from, to);
        return {
          type,
          listings: counts.reduce((a, b) => a + b, 0),
          median: binnedQuantile(counts, BINS.min, BINS.width, 0.5),
          q1: binnedQuantile(counts, BINS.min, BINS.width, 0.25),
          q3: binnedQuantile(counts, BINS.min, BINS.width, 0.75),
        };
      }),
    );
  },
};
