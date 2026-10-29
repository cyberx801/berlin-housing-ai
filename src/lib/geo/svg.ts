import { geoMercator, geoPath, type GeoPermissibleObjects, type GeoProjection } from "d3-geo";

export interface SvgFrame {
  width: number;
  height: number;
  /** Inner padding in px. */
  padding?: number;
}

type GeoObject = GeoPermissibleObjects;

/** Mercator fitted to `extent` (conformal; fine at city scale). */
export function fitProjection(extent: GeoObject, { width, height, padding = 0 }: SvgFrame): GeoProjection {
  return geoMercator().fitExtent(
    [
      [padding, padding],
      [width - padding, height - padding],
    ],
    extent,
  );
}

/** SVG path data with coordinates rounded to 0.1 px to keep inline SVG small. */
export function svgPath(projection: GeoProjection, object: GeoObject): string {
  return geoPath(projection).digits(1)(object) ?? "";
}

export function projectPoint(projection: GeoProjection, lonLat: [number, number]): [number, number] {
  const p = projection(lonLat);
  if (!p) throw new Error(`Point outside projection: ${lonLat.join(",")}`);
  return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
}

/** Height that preserves the extent's aspect ratio at a given width. */
export function aspectHeight(extent: GeoObject, width: number): number {
  const projection = geoMercator().fitWidth(width, extent);
  const [[, y0], [, y1]] = geoPath(projection).bounds(extent);
  return Math.ceil(y1 - y0);
}
