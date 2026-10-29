import { geoPath } from "d3-geo";
import { fitProjection, projectPoint, svgPath } from "@/lib/geo/svg";
import type { PlateFeatureCollection, Plates } from "@/types/geo";

const WIDTH = 480;
const HEIGHT = 360;
const PADDING = 20;

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
export function LocatorPlate({ idPrefix, plates, focus, context, title, description }: LocatorPlateProps) {
  const frameCodes = new Set([focus.code, ...context.map((c) => c.code)]);
  const frame: PlateFeatureCollection = {
    type: "FeatureCollection",
    features: plates.ortsteile.features.filter((f) => frameCodes.has(f.properties.code ?? "")),
  };
  const projection = fitProjection(frame, { width: WIDTH, height: HEIGHT, padding: PADDING });
  const bounds = geoPath(projection);

  // Only paths that reach into the frame are emitted.
  const visible = plates.ortsteile.features.filter((f) => {
    const [[x0, y0], [x1, y1]] = bounds.bounds(f);
    return x1 >= 0 && x0 <= WIDTH && y1 >= 0 && y0 <= HEIGHT;
  });
  const focusFeature = plates.ortsteile.features.find((f) => f.properties.code === focus.code);
  const ringD = svgPath(projection, plates.ring);

  const labels = [focus, ...context]
    .map((l) => ({ ...l, xy: projectPoint(projection, l.point) }))
    .filter(({ xy: [x, y] }) => x > 24 && x < WIDTH - 24 && y > 12 && y < HEIGHT - 12);

  return (
    <div className="relative">
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
            className={`label-halo absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap type-label ${
              l.code === focus.code ? "font-[750] text-ink" : "text-ink-2"
            }`}
            style={{ left: `${(l.xy[0] / WIDTH) * 100}%`, top: `${(l.xy[1] / HEIGHT) * 100}%` }}
          >
            {l.name}
          </span>
        ))}
      </div>
    </div>
  );
}
