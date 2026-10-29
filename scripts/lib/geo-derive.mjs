// Pure derivation rules for the geodata build (docs/architecture/DATA_BOUNDARIES.md §6).
// Kept dependency-free so they can be unit-tested directly.

/** Ring status thresholds on the share of an Ortsteil's area inside the Umweltzone. */
export const RING_INSIDE_MIN = 0.95;
export const RING_OUTSIDE_MAX = 0.05;

/**
 * URL slug for a German place name: ä→ae, ö→oe, ü→ue, ß→ss, other diacritics stripped.
 * @param {string} name
 * @returns {string}
 */
export function slugify(name) {
  return name
    .normalize("NFC")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Official 4-digit Ortsteil number (BBOO) from the 12-digit ALKIS `sch` key.
 * @param {string} sch e.g. "110000010102"
 */
export function ortsteilCodeFromSch(sch) {
  assertSch(sch);
  return sch.slice(-4);
}

/**
 * 2-digit Bezirk code ("01"–"12") from the ALKIS `sch` key.
 * @param {string} sch
 */
export function bezirkCodeFromSch(sch) {
  assertSch(sch);
  return sch.slice(6, 8);
}

/**
 * @param {number} share area share inside the Umweltzone, 0–1
 * @returns {"inside" | "partly" | "outside"}
 */
export function ringStatusFromShare(share) {
  if (!Number.isFinite(share) || share < 0 || share > 1.0001) {
    throw new Error(`Invalid ring share: ${share}`);
  }
  if (share >= RING_INSIDE_MIN) return "inside";
  if (share <= RING_OUTSIDE_MAX) return "outside";
  return "partly";
}

/** @param {string} sch */
function assertSch(sch) {
  if (typeof sch !== "string" || !/^\d{12}$/.test(sch)) {
    throw new Error(`Unexpected ALKIS sch key: ${JSON.stringify(sch)}`);
  }
}

/**
 * Normalizes mapshaper output (which is a GeometryCollection when a layer has no attributes)
 * to a FeatureCollection.
 * @param {any} geojson
 */
export function toFeatureCollection(geojson) {
  if (geojson.type === "FeatureCollection") return geojson;
  if (geojson.type === "GeometryCollection") {
    return {
      type: "FeatureCollection",
      features: geojson.geometries.map((geometry) => ({ type: "Feature", properties: {}, geometry })),
    };
  }
  throw new Error(`Unexpected GeoJSON type ${geojson.type}`);
}

/**
 * Rewinds polygon rings to d3-geo's convention: exterior rings clockwise, holes
 * counter-clockwise (in lon/lat with latitude increasing northward). RFC 7946 output is the
 * opposite, which d3 would read as "the whole globe minus this polygon".
 * @param {{type: string, coordinates: any}} geometry
 */
export function rewindForD3(geometry) {
  const fix = (rings) =>
    rings.map((ring, i) => {
      const clockwise = signedArea(ring) < 0;
      const wantClockwise = i === 0;
      return clockwise === wantClockwise ? ring : [...ring].reverse();
    });
  if (geometry.type === "Polygon") return { ...geometry, coordinates: fix(geometry.coordinates) };
  if (geometry.type === "MultiPolygon") {
    return { ...geometry, coordinates: geometry.coordinates.map(fix) };
  }
  return geometry;
}

function signedArea(ring) {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return sum / 2; // > 0 counter-clockwise, < 0 clockwise
}

/**
 * Planar ray-casting point-in-polygon for a GeoJSON (Multi)Polygon, holes respected.
 * Used only as a cross-check of the sch → Bezirk mapping on interior points.
 * @param {[number, number]} pt
 * @param {{type: string, coordinates: any}} geometry
 */
export function pointInGeometry(pt, geometry) {
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.some(
    (rings) => inRing(pt, rings[0]) && !rings.slice(1).some((hole) => inRing(pt, hole)),
  );
}

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
