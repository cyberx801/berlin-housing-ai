import { geoArea } from "d3-geo";
import {
  getBezirke,
  getBezirkOptions,
  getOrtsteil,
  getOrtsteilBySlug,
  getOrtsteile,
  getOrtsteilOptions,
  getPlates,
} from "@/lib/data/geo";

// These run against the committed build output of scripts/build-geo.mjs.
describe("generated geodata", () => {
  const ortsteile = getOrtsteile();
  const bezirke = getBezirke();

  it("has Berlin's 97 Ortsteile in 12 Bezirke, with unique codes and slugs", () => {
    expect(ortsteile).toHaveLength(97);
    expect(bezirke).toHaveLength(12);
    expect(new Set(ortsteile.map((o) => o.code)).size).toBe(97);
    expect(new Set(ortsteile.map((o) => o.slug)).size).toBe(97);
    expect(bezirke.flatMap((b) => b.ortsteilCodes).sort()).toEqual(ortsteile.map((o) => o.code).sort());
  });

  it("keeps each Ortsteil's code prefix equal to its Bezirk code", () => {
    for (const o of ortsteile) expect(o.code.slice(0, 2)).toBe(o.bezirkCode);
  });

  it("has symmetric neighbor lists", () => {
    for (const o of ortsteile) {
      for (const n of o.neighbors) expect(getOrtsteil(n)?.neighbors).toContain(o.code);
    }
  });

  it("derives ring status from the share with the documented thresholds", () => {
    for (const o of ortsteile) {
      const expected = o.ringShare >= 0.95 ? "inside" : o.ringShare <= 0.05 ? "outside" : "partly";
      expect(o.ringStatus).toBe(expected);
    }
  });

  it("sums Ortsteil areas to roughly Berlin's 891 km²", () => {
    const total = ortsteile.reduce((sum, o) => sum + o.areaKm2, 0);
    expect(Math.abs(total - 891.1) / 891.1).toBeLessThan(0.01);
  });

  it("resolves known places", () => {
    const moabit = getOrtsteilBySlug("moabit");
    expect(moabit?.code).toBe("0102");
    expect(moabit?.bezirkCode).toBe("01");
    expect(getOrtsteilBySlug("neukoelln")?.name).toBe("Neukölln");
  });

  it("sorts options in German collation", () => {
    const names = getBezirkOptions().map((b) => b.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "de")));
    expect(getOrtsteilOptions()).toHaveLength(97);
  });

  it("ships plate geometry wound the way d3-geo expects", () => {
    const { ortsteile: features, bezirke: districts, ring } = getPlates();
    expect(features.features).toHaveLength(97);
    expect(districts.features).toHaveLength(12);
    for (const f of [...features.features, ...districts.features, ...ring.features]) {
      expect(geoArea(f)).toBeLessThan(1e-3);
    }
  });
});
