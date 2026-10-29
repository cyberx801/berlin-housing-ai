import { geoArea } from "d3-geo";
import { RING_INSIDE_MIN as APP_INSIDE_MIN, RING_OUTSIDE_MAX as APP_OUTSIDE_MAX } from "@/lib/geo/ring";
import {
  RING_INSIDE_MIN,
  RING_OUTSIDE_MAX,
  bezirkCodeFromSch,
  ortsteilCodeFromSch,
  pointInGeometry,
  rewindForD3,
  ringStatusFromShare,
  slugify,
  toFeatureCollection,
} from "../../scripts/lib/geo-derive.mjs";

describe("slugify", () => {
  it.each([
    ["Moabit", "moabit"],
    ["Neukölln", "neukoelln"],
    ["Prenzlauer Berg", "prenzlauer-berg"],
    ["Friedrichshain-Kreuzberg", "friedrichshain-kreuzberg"],
    ["Müggelheim", "mueggelheim"],
    ["Schöneberg", "schoeneberg"],
    ["Französisch Buchholz", "franzoesisch-buchholz"],
    ["Groß-Ziethen", "gross-ziethen"],
  ])("%s → %s", (name, slug) => {
    expect(slugify(name)).toBe(slug);
  });

  it("treats decomposed umlauts like composed ones", () => {
    expect(slugify("Neukölln")).toBe("neukoelln");
  });
});

describe("ALKIS sch key", () => {
  it("takes the Ortsteil code from the last four digits and the Bezirk from digits 7–8", () => {
    expect(ortsteilCodeFromSch("110000010102")).toBe("0102");
    expect(bezirkCodeFromSch("110000010102")).toBe("01");
    expect(bezirkCodeFromSch("110000120214")).toBe("12");
  });

  it("rejects malformed keys instead of guessing", () => {
    expect(() => ortsteilCodeFromSch("0102")).toThrow(/sch/);
    expect(() => bezirkCodeFromSch("11000001010X")).toThrow(/sch/);
  });
});

describe("ringStatusFromShare", () => {
  it("applies the 95 % / 5 % thresholds inclusively", () => {
    expect(ringStatusFromShare(1)).toBe("inside");
    expect(ringStatusFromShare(0.95)).toBe("inside");
    expect(ringStatusFromShare(0.9499)).toBe("partly");
    expect(ringStatusFromShare(0.0501)).toBe("partly");
    expect(ringStatusFromShare(0.05)).toBe("outside");
    expect(ringStatusFromShare(0)).toBe("outside");
  });

  it("uses the same thresholds as the app", () => {
    expect(APP_INSIDE_MIN).toBe(RING_INSIDE_MIN);
    expect(APP_OUTSIDE_MAX).toBe(RING_OUTSIDE_MAX);
  });

  it("rejects impossible shares", () => {
    expect(() => ringStatusFromShare(-0.1)).toThrow();
    expect(() => ringStatusFromShare(1.2)).toThrow();
    expect(() => ringStatusFromShare(Number.NaN)).toThrow();
  });
});

// A 0.1° square near Berlin, counter-clockwise as RFC 7946 requires.
const ccwSquare = [
  [13.3, 52.5],
  [13.4, 52.5],
  [13.4, 52.6],
  [13.3, 52.6],
  [13.3, 52.5],
];

describe("rewindForD3", () => {
  it("turns an RFC 7946 polygon into one d3-geo reads as small, not as the rest of the globe", () => {
    const rfc: GeoJSON.Polygon = { type: "Polygon", coordinates: [ccwSquare] };
    expect(geoArea(rfc)).toBeGreaterThan(6); // whole sphere is 4π ≈ 12.57 sr

    const fixed = rewindForD3(rfc) as GeoJSON.Polygon;
    expect(geoArea(fixed)).toBeLessThan(1e-5);
  });

  it("leaves already-clockwise exteriors alone and is idempotent", () => {
    const once = rewindForD3({ type: "Polygon", coordinates: [ccwSquare] });
    const twice = rewindForD3(once);
    expect(twice).toEqual(once);
  });

  it("winds holes opposite to the exterior", () => {
    const hole = [
      [13.32, 52.52],
      [13.38, 52.52],
      [13.38, 52.58],
      [13.32, 52.58],
      [13.32, 52.52],
    ];
    const fixed = rewindForD3({ type: "Polygon", coordinates: [ccwSquare, hole] }) as GeoJSON.Polygon;
    const outer = geoArea({ type: "Polygon", coordinates: [fixed.coordinates[0]!] });
    const withHole = geoArea(fixed);
    expect(withHole).toBeLessThan(outer);
    expect(withHole).toBeGreaterThan(0);
  });
});

describe("pointInGeometry", () => {
  it("respects holes and multipolygon parts", () => {
    const hole = [
      [13.32, 52.52],
      [13.38, 52.52],
      [13.38, 52.58],
      [13.32, 52.58],
      [13.32, 52.52],
    ];
    const polygon = { type: "Polygon", coordinates: [ccwSquare, hole] };
    expect(pointInGeometry([13.31, 52.51], polygon)).toBe(true);
    expect(pointInGeometry([13.35, 52.55], polygon)).toBe(false);
    expect(pointInGeometry([13.5, 52.5], polygon)).toBe(false);

    const multi = { type: "MultiPolygon", coordinates: [[ccwSquare], [ccwSquare.map(([x, y]) => [x! + 1, y!])]] };
    expect(pointInGeometry([14.35, 52.55], multi)).toBe(true);
  });
});

describe("toFeatureCollection", () => {
  it("wraps mapshaper's attribute-less GeometryCollection output", () => {
    const fc = toFeatureCollection({
      type: "GeometryCollection",
      geometries: [{ type: "Polygon", coordinates: [ccwSquare] }],
    });
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features).toHaveLength(1);
  });

  it("refuses anything else", () => {
    expect(() => toFeatureCollection({ type: "Point", coordinates: [0, 0] })).toThrow();
  });
});
