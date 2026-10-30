// @vitest-environment node
import golden from "./rent-model.golden.json";
import { predictRent } from "@/lib/model/rent-model";

// The golden file holds the Python service's answers (scripts/build-rent-golden.py). The TypeScript
// port must agree: exactly where nothing is missing from the request, closely where the Python
// service samples the training distribution and this port takes the exact expectation.
const NOW = new Date("2026-10-30T12:00:00Z");
type Case = { request: Record<string, unknown>; status: number; body: Record<string, any> }; // eslint-disable-line @typescript-eslint/no-explicit-any
const cases = Object.entries(golden as unknown as Record<string, Case>);
const run = (request: unknown) => predictRent(request, { requestId: "golden", now: NOW });

const near = (actual: number, expected: number, rel: number) =>
  expect(Math.abs(actual - expected) / expected).toBeLessThanOrEqual(rel);

describe("rent model port", () => {
  for (const [name, c] of cases.filter(([, c]) => c.status === 200)) {
    it(`${name}: agrees with the Python service`, () => {
      const got = run(c.request);
      const want = c.body;
      expect(got.status).toBe(200);
      const b = got.body as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
      const sampled = want.inputs.imputed.length > 0;

      const [gp, wp] = [b.estimate.monthly_cold_rent.value, want.estimate.monthly_cold_rent.value];
      if (sampled) near(gp, wp, 0.01);
      else expect(gp).toBeCloseTo(wp, 2);
      near(b.estimate.interval.lower, want.estimate.interval.lower, sampled ? 0.04 : 0.005);
      near(b.estimate.interval.upper, want.estimate.interval.upper, sampled ? 0.04 : 0.005);
      expect(b.estimate.interval.level).toBe(0.8);
      expect(b.estimate.rent_per_m2.value).toBeCloseTo(gp / Number(c.request.area_m2), 1);

      expect(b.model).toEqual(want.model);
      expect(b.model.training_data.synthetic).toBe(true);
      expect(b.data_reference_date).toBe(want.data_reference_date);
      expect(b.inputs).toEqual(want.inputs);
      expect(b.warnings).toEqual(want.warnings);
      expect(b.api_version).toBe(want.api_version);
      expect(b.generated_at).toBe(want.generated_at);

      const tol = sampled ? 1 : 0.06; // percentage points; Python estimates the sampled ones from 4,000 draws
      near(b.explanation.baseline_rent_per_m2, want.explanation.baseline_rent_per_m2, sampled ? 0.01 : 0.001);
      // Only the eight largest factors are listed, so near-zero ones can swap places at the cut-off.
      type Factor = { feature: string; effect_pct: number };
      const mine = new Map((b.explanation.factors as Factor[]).map((f) => [f.feature, f.effect_pct]));
      const shared = (want.explanation.factors as Factor[]).filter((f) => mine.has(f.feature));
      expect(shared.length).toBeGreaterThanOrEqual(4);
      for (const f of shared) expect(Math.abs((mine.get(f.feature) ?? NaN) - f.effect_pct)).toBeLessThanOrEqual(tol);
      expect((b.explanation.factors as Factor[])[0]?.feature).toBe((want.explanation.factors as Factor[])[0]?.feature);
    });
  }

  for (const [name, c] of cases.filter(([, c]) => c.status !== 200)) {
    it(`${name}: is refused with the same field errors`, () => {
      const got = run(c.request);
      expect(got.status).toBe(c.status);
      expect(got.body).toEqual(c.body);
    });
  }

  it("gives the same answer twice for the same request", () => {
    const sparse = (golden as unknown as Record<string, Case>).sparse!.request;
    expect(run(sparse).body).toEqual(run(sparse).body);
  });

  it("the point estimate rises with the living area", () => {
    const full = (golden as unknown as Record<string, Case>).full!.request;
    const rent = (r: Record<string, unknown>) =>
      ((run(r).body.estimate as { monthly_cold_rent: { value: number } }).monthly_cold_rent.value);
    expect(rent({ ...full, area_m2: 130 })).toBeGreaterThan(rent(full));
  });

  it("widens the interval when inputs are missing", () => {
    const g = golden as unknown as Record<string, Case>;
    const width = (r: Record<string, unknown>) => {
      const e = run(r).body.estimate as { monthly_cold_rent: { value: number }; interval: { lower: number; upper: number } };
      return (e.interval.upper - e.interval.lower) / e.monthly_cold_rent.value;
    };
    expect(width(g.sparse!.request)).toBeGreaterThan(width(g.full!.request));
  });

  it("refuses anything that is not a JSON object", () => {
    for (const bad of [null, [1, 2], "x", 3]) expect(run(bad).status).toBe(422);
  });

  it("treats a decomposed (NFD) Bezirk like the composed one", () => {
    const sparse = (golden as unknown as Record<string, Case>).sparse!.request;
    const nfd = { ...sparse, bezirk: String(sparse.bezirk).normalize("NFD") };
    expect(run(nfd).status).toBe(200);
  });
});
