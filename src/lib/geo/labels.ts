// Label placement for SVG plates whose HTML labels keep a constant size while the plate scales.
// Boxes are estimated from the label type (`type-label`: 13 px Archivo at wdth 75), measured at
// about 5.9 px per character, 6.4 bold, and 17 px tall.

const CHAR_PX = 6;
const BOLD_CHAR_PX = 6.4;
const HEIGHT_PX = 17;
/** Clear space kept between two labels and from the plate edge. */
const GAP_PX = 4;

export interface LabelCandidate {
  code: string;
  name: string;
  /** Position in viewBox units. */
  xy: [number, number];
  bold?: boolean;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function box({ name, xy: [x, y], bold }: LabelCandidate, scale: number): Box {
  const halfWidth = ((name.length * (bold ? BOLD_CHAR_PX : CHAR_PX) + GAP_PX) * scale) / 2;
  const halfHeight = ((HEIGHT_PX + GAP_PX) * scale) / 2;
  return { x0: x - halfWidth, y0: y - halfHeight, x1: x + halfWidth, y1: y + halfHeight };
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Greedy placement in priority order: a label is kept when its box lies inside the plate and
 * clears every label kept before it. `keep` are placed first and always kept (the focus label,
 * or the set already chosen for a narrower rendering), so a wider set always contains them.
 */
export function placeLabels(
  candidates: readonly LabelCandidate[],
  frame: { width: number; height: number; renderedWidth: number },
  keep: ReadonlySet<string> = new Set(),
): Set<string> {
  const scale = frame.width / frame.renderedWidth;
  const placed: Box[] = [];
  const kept = new Set<string>();
  for (const candidate of candidates.filter((c) => keep.has(c.code))) {
    placed.push(box(candidate, scale));
    kept.add(candidate.code);
  }
  for (const candidate of candidates) {
    if (kept.has(candidate.code)) continue;
    const b = box(candidate, scale);
    const inside = b.x0 >= 0 && b.y0 >= 0 && b.x1 <= frame.width && b.y1 <= frame.height;
    if (inside && !placed.some((p) => overlaps(p, b))) {
      placed.push(b);
      kept.add(candidate.code);
    }
  }
  return kept;
}
