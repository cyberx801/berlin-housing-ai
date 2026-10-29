import { geoMercator } from "d3-geo";
import Link from "next/link";
import { formatKm2 } from "@/lib/formatting/number";
import { svgPath } from "@/lib/geo/svg";
import type { Plates } from "@/types/geo";

const TILE_W = 160;
const TILE_H = 120;
const PADDING = 6;

export interface BezirkTile {
  code: string;
  name: string;
  slug: string;
  areaKm2: number;
  ortsteilCount: number;
  bbox: [number, number, number, number];
}

/**
 * The 12 Bezirke as silhouettes on one shared map scale, so their sizes compare honestly.
 * Each links to its Ortsteile in the directory.
 */
export function BezirkMultiples({ plates, bezirke }: { plates: Plates; bezirke: readonly BezirkTile[] }) {
  const featureByCode = new Map(plates.bezirke.features.map((f) => [f.properties.code ?? "", f]));

  // The largest Bezirk sets the scale; every tile uses it.
  const scale = Math.min(
    ...bezirke.map((b) => {
      const feature = featureByCode.get(b.code);
      if (!feature) throw new Error(`No plate geometry for Bezirk ${b.code}`);
      return geoMercator()
        .fitExtent(
          [
            [PADDING, PADDING],
            [TILE_W - PADDING, TILE_H - PADDING],
          ],
          feature,
        )
        .scale();
    }),
  );

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 lg:grid-cols-6">
      {bezirke.map((b) => {
        const feature = featureByCode.get(b.code)!;
        const [x0, y0, x1, y1] = b.bbox;
        const projection = geoMercator()
          .scale(scale)
          .center([(x0 + x1) / 2, (y0 + y1) / 2])
          .translate([TILE_W / 2, TILE_H / 2]);
        const ortsteile = plates.ortsteile.features.filter((f) => f.properties.code?.startsWith(b.code));
        return (
          <li key={b.code}>
            <Link
              href={`/neighborhoods?bezirk=${b.slug}`}
              className="group flex flex-col gap-2 no-underline"
            >
              <svg viewBox={`0 0 ${TILE_W} ${TILE_H}`} aria-hidden="true" className="block h-auto w-full bg-sheet">
                <g style={{ fill: "var(--color-sheet)", stroke: "var(--color-line-strong)", strokeWidth: 0.5 }}>
                  {ortsteile.map((f) => (
                    <path key={f.properties.code} d={svgPath(projection, f, 0)} vectorEffect="non-scaling-stroke" />
                  ))}
                </g>
                <path
                  d={svgPath(projection, feature, 0)}
                  className="group-hover:[--outline:2.5]"
                  style={{ fill: "none", stroke: "var(--color-ink)", strokeWidth: "var(--outline, 1.25)", strokeLinejoin: "round" }}
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <span className="flex flex-col">
                <span className="type-body font-[640] underline decoration-transparent underline-offset-4 group-hover:decoration-ink">
                  {b.name}
                </span>
                <span className="type-small text-ink-2 tabular">
                  {b.ortsteilCount} Ortsteile, {formatKm2(b.areaKm2)}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
