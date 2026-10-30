import { laeaToLonLat } from "../../scripts/lib/laea.mjs";

// Expected values come from proj4 (EPSG:3035 = +proj=laea +lat_0=52 +lon_0=10 +x_0=4321000 +y_0=3210000 +ellps=GRS80),
// forward-projected from known WGS84 points.
const POINTS = [
  { lon: 13.3777, lat: 52.5163, e: 4550204.841, n: 3272770.588 }, // Brandenburger Tor
  { lon: 13.09, lat: 52.34, e: 4531532.726, n: 3252300.304 },
  { lon: 13.76, lat: 52.68, e: 4575175.0, n: 3292238.18 },
  { lon: 13.09, lat: 52.68, e: 4529918.165, n: 3290104.631 },
  { lon: 13.76, lat: 52.34, e: 4577139.443, n: 3254447.843 },
];

describe("laeaToLonLat", () => {
  it.each(POINTS)("inverts EPSG:3035 at $lon, $lat to within a decimetre", ({ lon, lat, e, n }) => {
    const out = laeaToLonLat(e, n);
    expect(Math.abs(out.lon - lon)).toBeLessThan(1e-6);
    expect(Math.abs(out.lat - lat)).toBeLessThan(1e-6);
  });

  it("returns the projection centre at the false origin", () => {
    const out = laeaToLonLat(4321000, 3210000);
    expect(out.lon).toBeCloseTo(10, 9);
    expect(out.lat).toBeCloseTo(52, 9);
  });
});
