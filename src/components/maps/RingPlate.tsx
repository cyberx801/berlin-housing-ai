import { aspectHeight, fitProjection, svgPath } from "@/lib/geo/svg";
import type { Plates } from "@/types/geo";
import { plateIds } from "./plate-ids";

export const RING_PLATE_WIDTH = 640;
const PADDING = 12;

export function ringPlateViewBox(plates: Pick<Plates, "outline">) {
  const height = aspectHeight(plates.outline, RING_PLATE_WIDTH - 2 * PADDING) + 2 * PADDING;
  return { width: RING_PLATE_WIDTH, height };
}

interface RingPlateProps {
  idPrefix: string;
  plates: Plates;
  title: string;
  description: string;
  /** Draw the ring in once per session (homepage hero only). */
  drawRing?: boolean;
}

/**
 * All 97 Ortsteile, the Bezirk borders, Berlin's outline and the Umweltzone (S-Bahn ring),
 * projected on the server. Ortsteil paths carry `data-code` for the client interaction layer.
 * Styles are inline (not classes) so `<use>` clones in the highlight layer look identical.
 */
export function RingPlate({ idPrefix, plates, title, description, drawRing = false }: RingPlateProps) {
  const ids = plateIds(idPrefix);
  const { width, height } = ringPlateViewBox(plates);
  const projection = fitProjection(plates.outline, { width, height, padding: PADDING });
  const ringD = svgPath(projection, plates.ring);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby={ids.title}
      aria-describedby={ids.desc}
      className="block h-auto w-full"
    >
      <title id={ids.title}>{title}</title>
      <desc id={ids.desc}>{description}</desc>
      <defs>
        {/* A thick, scaling stroke reveals the ring; the visible ring keeps a constant pixel width. */}
        <mask id={ids.ringMask} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
          <path
            d={ringD}
            fill="none"
            stroke="#fff"
            strokeWidth={28}
            strokeLinejoin="round"
            pathLength={1}
            className={drawRing ? "ring-draw" : undefined}
          />
        </mask>
      </defs>

      <g
        style={{
          fill: "var(--color-sheet)",
          stroke: "var(--color-line-strong)",
          strokeWidth: 0.75,
          strokeLinejoin: "round",
        }}
      >
        {plates.ortsteile.features.map((feature) => {
          const code = feature.properties.code ?? "";
          return (
            <path
              key={code}
              id={ids.ortsteil(code)}
              data-code={code}
              d={svgPath(projection, feature)}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </g>

      <g
        id={ids.borders}
        style={{
          fill: "none",
          stroke: "var(--color-ink)",
          strokeWidth: 1.5,
          strokeLinejoin: "round",
          strokeLinecap: "round",
          pointerEvents: "none",
        }}
      >
        <path d={svgPath(projection, plates.bezirkBorders)} vectorEffect="non-scaling-stroke" />
        <path d={svgPath(projection, plates.outline)} vectorEffect="non-scaling-stroke" />
      </g>

      <g
        id={ids.ring}
        mask={`url(#${ids.ringMask})`}
        style={{ fill: "none", strokeLinejoin: "round", pointerEvents: "none" }}
      >
        <path d={ringD} style={{ stroke: "var(--color-sheet)", strokeWidth: 4.5 }} vectorEffect="non-scaling-stroke" />
        <path d={ringD} style={{ stroke: "var(--color-ink)", strokeWidth: 2.5 }} vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}
