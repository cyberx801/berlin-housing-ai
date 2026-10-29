import { PROVENANCE_COPY } from "@/components/provenance/provenance-copy";
import { cx } from "@/lib/cx";
import type { Provenance } from "@/types/provenance";

/** Categorical slots in the fixed order (DESIGN_SYSTEM §8.1). Full class names, so Tailwind sees them. */
export type SeriesSlot = 1 | 2 | 3 | 4 | 5 | 6;
export const SERIES_STROKE: Record<SeriesSlot, string> = {
  1: "stroke-series-1",
  2: "stroke-series-2",
  3: "stroke-series-3",
  4: "stroke-series-4",
  5: "stroke-series-5",
  6: "stroke-series-6",
};
export const SERIES_FILL: Record<SeriesSlot, string> = {
  1: "fill-series-1",
  2: "fill-series-2",
  3: "fill-series-3",
  4: "fill-series-4",
  5: "fill-series-5",
  6: "fill-series-6",
};
const SERIES_BG: Record<SeriesSlot, string> = {
  1: "bg-series-1",
  2: "bg-series-2",
  3: "bg-series-3",
  4: "bg-series-4",
  5: "bg-series-5",
  6: "bg-series-6",
};

/** Height reserved above the plot for the in-SVG provenance stamp. */
export const STAMP_SPACE = 26;

/**
 * Demo charts carry their label inside the SVG (DESIGN_SYSTEM §7), so a screenshot or a
 * cropped export still says it. Other provenance kinds draw nothing here; their band does it.
 */
export function ProvenanceStamp({ provenance, x = 0, y = 14 }: { provenance: Provenance; x?: number; y?: number }) {
  if (provenance.kind !== "demo") return null;
  return (
    <text x={x} y={y} className="fill-ink-3 type-small" data-provenance-stamp="demo">
      {PROVENANCE_COPY.demo.label}
    </text>
  );
}

/** A short stroke of the series color: the identity key beside a label (never colored text). */
export function LineKey({ slot, className }: { slot: SeriesSlot; className?: string }) {
  return <span aria-hidden="true" className={cx("inline-block h-[3px] w-4 shrink-0 rounded-full", SERIES_BG[slot], className)} />;
}

/** Rough width of a label at the condensed label size, used to plan margins before drawing. */
export function estimateLabelWidth(text: string, fontPx = 13): number {
  return Math.ceil(text.length * fontPx * 0.56) + 4;
}

/** A bar with a 4 px rounded data end and a square baseline end (DESIGN_SYSTEM §8.4). */
export function barPath(
  { x, y, width, height }: { x: number; y: number; width: number; height: number },
  end: "right" | "top",
): string {
  const r = Math.max(0, Math.min(4, end === "right" ? width : height, end === "right" ? height / 2 : width / 2));
  if (end === "right") {
    return `M${x},${y}h${width - r}a${r},${r} 0 0 1 ${r},${r}v${height - 2 * r}a${r},${r} 0 0 1 ${-r},${r}h${-(width - r)}z`;
  }
  return `M${x},${y + height}v${-(height - r)}a${r},${r} 0 0 1 ${r},${-r}h${width - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${height - r}z`;
}
