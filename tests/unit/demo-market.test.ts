import { readFileSync } from "node:fs";
import path from "node:path";
import { binnedQuantile, demoMarketSource as source } from "@/lib/data/market/demo-source";
import { getMarketSource } from "@/lib/data/market";
import { buildDemoMarket, DEMO_MARKET_SEED, sampleMedian, serializeDemoMarket } from "../../scripts/lib/demo-market.mjs";

const ROOT = process.cwd();
const fixturePath = path.join(ROOT, "src/lib/fixtures/demo/market-v1.json");
const fixtureText = readFileSync(fixturePath, "utf8").replace(/\r\n/g, "\n");
const fixture = JSON.parse(fixtureText) as {
  _provenance: { kind: string; fixtureId: string };
  generator: { seed: number };
  gaps: { bezirk: string; type: string }[];
  monthly: Record<string, Record<string, { median: (number | null)[]; listings: number[] }>>;
  yearly: Record<string, Record<string, number[][]>>;
};

const ALL_YEARS = { from: 2020, to: 2025 };
const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0);

describe("demo market fixture", () => {
  it("is exactly what the seeded generator produces", () => {
    expect(fixture.generator.seed).toBe(DEMO_MARKET_SEED);
    expect(serializeDemoMarket(buildDemoMarket())).toBe(fixtureText);
  });

  it("is deterministic, and a different seed gives different values", () => {
    expect(buildDemoMarket(1)).toEqual(buildDemoMarket(1));
    expect(buildDemoMarket(2).monthly).not.toEqual(buildDemoMarket(1).monthly);
  });

  it("declares itself demo data, with a README beside it", () => {
    expect(fixture._provenance).toMatchObject({ kind: "demo", fixtureId: "demo-market-v1" });
    expect(source.provenance.kind).toBe("demo");
    expect(getMarketSource()).toBe(source);
    const readme = readFileSync(path.join(ROOT, "src/lib/fixtures/demo/README.md"), "utf8");
    expect(readme).toMatch(/Demo data, not Berlin market statistics/);
    expect(readme).toMatch(/follow no real ranking/);
  });

  it("leaves exactly the documented gaps empty", () => {
    expect(fixture.gaps).toHaveLength(4);
    for (const gap of fixture.gaps) {
      expect(sum(fixture.yearly[gap.bezirk]![gap.type]!.flat())).toBe(0);
      expect(fixture.monthly[gap.bezirk]![gap.type]!.median.every((v) => v === null)).toBe(true);
    }
    // Apartments are never a gap, so "all types" always has a series.
    expect(fixture.gaps.some((g) => g.type === "apartment")).toBe(false);
  });

  it("counts every simulated listing once in both the monthly and the yearly aggregates", () => {
    const yearlyTotal = sum(Object.values(fixture.yearly).flatMap((byType) => Object.values(byType).flat(2)));
    expect(sum(fixture.monthly.berlin!.all!.listings)).toBe(yearlyTotal);
  });
});

describe("sampleMedian and binnedQuantile", () => {
  it("takes exact medians of samples", () => {
    expect(sampleMedian([])).toBeNull();
    expect(sampleMedian([3, 1, 2])).toBe(2);
    expect(sampleMedian([4, 1, 2, 3])).toBe(2.5);
  });

  it("interpolates quantiles inside 1 € bins", () => {
    // 10 listings in €5–6, 10 in €6–7: the median sits on the €6 edge.
    expect(binnedQuantile([10, 10], 5, 1, 0.5)).toBe(6);
    expect(binnedQuantile([10, 10], 5, 1, 0.25)).toBe(5.5);
    expect(binnedQuantile([0, 4, 0], 5, 1, 0.5)).toBe(6.5);
    expect(binnedQuantile([0, 0], 5, 1, 0.5)).toBeNull();
  });
});

describe("demo market source", () => {
  it("covers 2020–2025 and the five market property types", () => {
    expect(source.coverage).toEqual({
      firstYear: 2020,
      lastYear: 2025,
      types: ["apartment", "maisonette", "penthouse", "loft", "house"],
    });
  });

  it("returns one all-Berlin line without Bezirke, and one line per Bezirk with them", async () => {
    const berlin = await source.rentTrend({ bezirke: [], ...ALL_YEARS, type: "all" });
    expect(berlin.series.map((s) => s.key)).toEqual(["berlin"]);
    expect(berlin.series[0]!.values).toHaveLength(72);
    expect(berlin.firstMonth).toBe("2020-01");

    const some = await source.rentTrend({ bezirke: ["03", "01"], from: 2023, to: 2024, type: "apartment" });
    expect(some.series.map((s) => s.key)).toEqual(["03", "01"]);
    expect(some.series[0]!.values).toHaveLength(24);
    expect(some.firstMonth).toBe("2023-01");
    expect(some.series[1]!.values).toEqual(fixture.monthly["01"]!.apartment!.median.slice(36, 60));
  });

  it("reports a Bezirk with no listings of the type as missing instead of an empty line", async () => {
    const gap = fixture.gaps[0]!;
    const other = gap.bezirk === "01" ? "02" : "01";
    const result = await source.rentTrend({
      bezirke: [gap.bezirk, other],
      ...ALL_YEARS,
      type: gap.type as "maisonette",
    });
    expect(result.missing).toEqual([gap.bezirk]);
    expect(result.series.map((s) => s.key)).toEqual([other]);
  });

  it("compares all 12 Bezirke, with no median where there are no listings", async () => {
    const all = await source.districtComparison({ ...ALL_YEARS, type: "all" });
    expect(all).toHaveLength(12);
    expect(all.every((d) => d.median !== null && d.listings > 0)).toBe(true);

    const gap = fixture.gaps[0]!;
    const typed = await source.districtComparison({ ...ALL_YEARS, type: gap.type as "maisonette" });
    expect(typed.find((d) => d.code === gap.bezirk)).toEqual({ code: gap.bezirk, median: null, listings: 0 });
  });

  it("sums the distribution over the chosen Bezirke and years", async () => {
    const one = await source.priceDistribution({ bezirke: ["01"], from: 2024, to: 2024, type: "apartment" });
    expect(one.total).toBe(sum(fixture.yearly["01"]!.apartment![4]!));
    expect(sum(one.counts)).toBe(one.total);
    expect(one.binWidth).toBe(2);
    expect(one.median).not.toBeNull();

    const two = await source.priceDistribution({ bezirke: ["01", "02"], from: 2024, to: 2024, type: "apartment" });
    const second = await source.priceDistribution({ bezirke: ["02"], from: 2024, to: 2024, type: "apartment" });
    expect(two.total).toBe(one.total + second.total);
  });

  it("compares every property type, with ordered quartiles", async () => {
    const types = await source.propertyTypeComparison({ bezirke: [], ...ALL_YEARS });
    expect(types.map((t) => t.type)).toEqual(["apartment", "maisonette", "penthouse", "loft", "house"]);
    for (const t of types) {
      expect(t.listings).toBeGreaterThan(0);
      expect(t.q1!).toBeLessThanOrEqual(t.median!);
      expect(t.median!).toBeLessThanOrEqual(t.q3!);
    }
    const gap = fixture.gaps[0]!;
    const inGap = await source.propertyTypeComparison({ bezirke: [gap.bezirk], ...ALL_YEARS });
    expect(inGap.find((t) => t.type === gap.type)).toMatchObject({ listings: 0, median: null, q1: null, q3: null });
  });
});
