import { geoPath, type GeoProjection } from "d3-geo";
import { cx } from "@/lib/cx";
import { placeLabels } from "@/lib/geo/labels";
import { fitProjection, projectPoint, svgPath } from "@/lib/geo/svg";
import type { PlateFeatureCollection, Plates } from "@/types/geo";

const WIDTH = 480;
const HEIGHT = 360;
const PADDING = 20;
// The plate is about 290 px wide on a phone and at least 448 px (a 28rem container, `@md`) in
// wider layouts. Labels that fit only the wider plate are hidden below that width.
const NARROW_PX = 288;
const WIDE_PX = 448;

export interface LocatorLabel {
  code: string;
  name: string;
  /** Interior point [lon, lat] from the geodata build. */
  point: [number, number];
}

interface LocatorPlateProps {
  idPrefix: string;
  plates: Plates;
  /** The marked Ortsteil. */
  focus: LocatorLabel;
  /** Ortsteile that define the frame along with the focus (usually its neighbors). */
  context: readonly LocatorLabel[];
  title: string;
  description: string;
}

/**
 * A cropped plate around one Ortsteil and its neighbors: the focus marked, Bezirk borders,
 * the ring, and HTML labels (constant size at any plate width, sentence case, no caps).
 */
function locatorProjection(plates: Plates, codes: readonly string[]): GeoProjection {
  const frameCodes = new Set(codes);
  const frame: PlateFeatureCollection = {
    type: "FeatureCollection",
    features: plates.ortsteile.features.filter((f) => frameCodes.has(f.properties.code ?? "")),
  };
  return fitProjection(frame, { width: WIDTH, height: HEIGHT, padding: PADDING });
}

/** Whether the ring line crosses the plate framed on these Ortsteile (so a caption can mention it). */
export function locatorShowsRing(plates: Plates, codes: readonly string[]): boolean {
  const projection = locatorProjection(plates, codes);
  return plates.ring.features.some((feature) => {
    const rings = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    return rings.some((polygon) =>
      polygon.some((ring) =>
        ring.some(([lon, lat]) => {
          const p = projection([lon!, lat!]);
          return p !== null && p[0] >= 0 && p[0] <= WIDTH && p[1] >= 0 && p[1] <= HEIGHT;
        }),
      ),
    );
  });
}

export function LocatorPlate({ idPrefix, plates, focus, context, title, description }: LocatorPlateProps) {
  const projection = locatorProjection(plates, [focus.code, ...context.map((c) => c.code)]);
  const bounds = geoPath(projection);

  // Only paths that reach into the frame are emitted.
  const visible = plates.ortsteile.features.filter((f) => {
    const [[x0, y0], [x1, y1]] = bounds.bounds(f);
    return x1 >= 0 && x0 <= WIDTH && y1 >= 0 && y0 <= HEIGHT;
  });
  const focusFeature = plates.ortsteile.features.find((f) => f.properties.code === focus.code);
  const ringD = svgPath(projection, plates.ring);

  // The focus is labelled first, then the larger neighbors; a label that would collide or run off
  // the plate is left out (the borders list and the description still name every neighbor).
  const areas = new Map(visible.map((f) => [f.properties.code, bounds.area(f)]));
  const candidates = [focus, ...[...context].sort((a, b) => (areas.get(b.code) ?? 0) - (areas.get(a.code) ?? 0))].map(
    (l) => ({ code: l.code, name: l.name, xy: projectPoint(projection, l.point), bold: l.code === focus.code }),
  );
  const narrow = placeLabels(candidates, { width: WIDTH, height: HEIGHT, renderedWidth: NARROW_PX }, new Set([focus.code]));
  const wide = placeLabels(candidates, { width: WIDTH, height: HEIGHT, renderedWidth: WIDE_PX }, narrow);
  const labels = candidates.filter((l) => wide.has(l.code));

  return (
    <div className="@container relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby={`${idPrefix}-title`}
        aria-describedby={`${idPrefix}-desc`}
        className="block h-auto w-full bg-sheet"
      >
        <title id={`${idPrefix}-title`}>{title}</title>
        <desc id={`${idPrefix}-desc`}>{description}</desc>
        <g style={{ fill: "var(--color-sheet)", stroke: "var(--color-line-strong)", strokeWidth: 0.75 }}>
          {visible.map((f) => (
            <path key={f.properties.code} d={svgPath(projection, f)} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
        {focusFeature ? (
          <path
            d={svgPath(projection, focusFeature)}
            style={{ fill: "var(--color-marker)", fillOpacity: 0.85 }}
          />
        ) : null}
        <g style={{ fill: "none", stroke: "var(--color-ink)", strokeWidth: 1.5, strokeLinejoin: "round" }}>
          <path d={svgPath(projection, plates.bezirkBorders)} vectorEffect="non-scaling-stroke" />
          <path d={svgPath(projection, plates.outline)} vectorEffect="non-scaling-stroke" />
        </g>
        <g style={{ fill: "none", strokeLinejoin: "round" }}>
          <path d={ringD} style={{ stroke: "var(--color-sheet)", strokeWidth: 4.5 }} vectorEffect="non-scaling-stroke" />
          <path d={ringD} style={{ stroke: "var(--color-ink)", strokeWidth: 2.5 }} vectorEffect="non-scaling-stroke" />
        </g>
        {focusFeature ? (
          <path
            d={svgPath(projection, focusFeature)}
            style={{ fill: "none", stroke: "var(--color-ink)", strokeWidth: 2 }}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        {labels.map((l) => (
          <span
            key={l.code}
            className={cx(
              "label-halo absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap type-label",
              l.bold ? "font-[750] text-ink" : "text-ink-2",
              !narrow.has(l.code) && "hidden @md:inline",
            )}
            style={{ left: `${(l.xy[0] / WIDTH) * 100}%`, top: `${(l.xy[1] / HEIGHT) * 100}%` }}
          >
            {l.name}
          </span>
        ))}
      </div>
    </div>
  );
}
