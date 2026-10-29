// Seeded generator for the demo market fixtures (docs/architecture/DATA_BOUNDARIES.md §5).
// Every parameter (Bezirk levels, type multipliers, volumes, gaps) is drawn from the seed, so
// the result follows no real-world ordering. It's a design-testing aid, not a model of Berlin.
// Kept dependency-free and deterministic so a test can rebuild it and compare with the file.

export const DEMO_MARKET_SEED = 20261029;
export const DEMO_MARKET_VERSION = 1;
export const DEMO_TYPES = ["apartment", "maisonette", "penthouse", "loft", "house"];
export const BEZIRK_CODES = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];

const FIRST_YEAR = 2020;
const YEARS = 6;
const MONTHS = YEARS * 12;
// €/m² histogram bins: 1 € wide from 5 to 45. Simulated values are clamped into this range.
const BIN_MIN = 5;
const BIN_WIDTH = 1;
const BIN_COUNT = 40;
const VALUE_MAX = BIN_MIN + BIN_WIDTH * BIN_COUNT - 0.01;

/** mulberry32: small, fast, and identical on every platform. */
function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createNormal(random) {
  return () => {
    const u = Math.max(random(), Number.EPSILON);
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

/** Knuth's method; fine for the small rates used here (< 100). */
function poisson(random, lambda) {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= random();
  } while (p > limit);
  return k - 1;
}

const round2 = (value) => Math.round(value * 100) / 100;

/** Exact sample median, or null for an empty sample. */
export function sampleMedian(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return round2(sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
}

function monthKey(index) {
  const year = FIRST_YEAR + Math.floor(index / 12);
  return `${year}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/**
 * Simulates synthetic listings month by month and keeps only aggregates:
 * monthly medians and listing counts per Bezirk (and all of Berlin) × type (and all types),
 * plus yearly 1 € histograms per Bezirk × type, from which any combination can be summed.
 */
export function buildDemoMarket(seed = DEMO_MARKET_SEED) {
  const random = createRandom(seed);
  const normal = createNormal(random);

  const bezirke = BEZIRK_CODES.map((code) => {
    // Base €/m² and monthly listing volume: uniform draws, assigned in code order.
    const base = 9 + random() * 9;
    const volume = 30 + random() * 60;
    const apartmentShare = 0.72 + random() * 0.1;
    const weights = DEMO_TYPES.slice(1).map(() => 0.2 + random());
    const weightSum = weights.reduce((a, b) => a + b, 0);
    const shares = [apartmentShare, ...weights.map((w) => ((1 - apartmentShare) * w) / weightSum)];
    return { code, base, volume, shares };
  });
  const multipliers = [1, ...DEMO_TYPES.slice(1).map(() => 0.9 + random() * 0.5)];

  // One deliberate gap per non-apartment type, in a Bezirk picked by the seed, so the
  // "no demo series for this combination" state exists. Not a statement about Berlin.
  const gaps = DEMO_TYPES.slice(1).map((type) => ({
    bezirk: BEZIRK_CODES[Math.floor(random() * BEZIRK_CODES.length)],
    type,
  }));
  for (const gap of gaps) {
    const bezirk = bezirke.find((b) => b.code === gap.bezirk);
    bezirk.shares[DEMO_TYPES.indexOf(gap.type)] = 0;
  }

  // A shared city-wide drift (log scale) plus a mean-reverting deviation per Bezirk.
  const city = [0];
  for (let m = 1; m < MONTHS; m += 1) city.push(city[m - 1] + 0.003 + 0.004 * normal());
  const deviation = bezirke.map(() => {
    const series = [0.02 * normal()];
    for (let m = 1; m < MONTHS; m += 1) series.push(0.85 * series[m - 1] + 0.01 * normal());
    return series;
  });

  const areas = [...BEZIRK_CODES, "berlin"];
  const typeKeys = [...DEMO_TYPES, "all"];
  const monthly = Object.fromEntries(
    areas.map((area) => [
      area,
      Object.fromEntries(typeKeys.map((t) => [t, { median: [], listings: [] }])),
    ]),
  );
  const yearly = Object.fromEntries(
    BEZIRK_CODES.map((code) => [
      code,
      Object.fromEntries(
        DEMO_TYPES.map((t) => [t, Array.from({ length: YEARS }, () => new Array(BIN_COUNT).fill(0))]),
      ),
    ]),
  );

  for (let m = 0; m < MONTHS; m += 1) {
    const year = Math.floor(m / 12);
    const berlin = Object.fromEntries(typeKeys.map((t) => [t, []]));
    bezirke.forEach((bezirk, b) => {
      const all = [];
      DEMO_TYPES.forEach((type, t) => {
        const count = poisson(random, bezirk.volume * bezirk.shares[t]);
        const level = bezirk.base * multipliers[t] * Math.exp(city[m] + deviation[b][m]);
        const values = [];
        for (let i = 0; i < count; i += 1) {
          const value = round2(Math.min(VALUE_MAX, Math.max(BIN_MIN, level * Math.exp(0.2 * normal()))));
          values.push(value);
          yearly[bezirk.code][type][year][Math.floor((value - BIN_MIN) / BIN_WIDTH)] += 1;
        }
        monthly[bezirk.code][type].median.push(sampleMedian(values));
        monthly[bezirk.code][type].listings.push(values.length);
        all.push(...values);
        berlin[type].push(...values);
      });
      monthly[bezirk.code].all.median.push(sampleMedian(all));
      monthly[bezirk.code].all.listings.push(all.length);
      berlin.all.push(...all);
    });
    for (const t of typeKeys) {
      monthly.berlin[t].median.push(sampleMedian(berlin[t]));
      monthly.berlin[t].listings.push(berlin[t].length);
    }
  }

  return {
    _provenance: {
      kind: "demo",
      fixtureId: "demo-market-v1",
      note: "Synthetic listings from a seeded generator, made to build and test this dashboard.",
    },
    generator: { script: "scripts/build-demo-fixtures.mjs", seed, version: DEMO_MARKET_VERSION },
    firstMonth: monthKey(0),
    lastMonth: monthKey(MONTHS - 1),
    types: DEMO_TYPES,
    bins: { min: BIN_MIN, width: BIN_WIDTH, count: BIN_COUNT },
    gaps,
    monthly,
    yearly,
  };
}

/** Pretty-prints with every number array on one line, so diffs stay readable. */
export function serializeDemoMarket(data) {
  return `${JSON.stringify(data, null, 2).replace(/\[\s+([-\d.,\snul]*?)\s+\]/g, (_, body) => `[${body.replace(/\s+/g, " ")}]`)}\n`;
}
