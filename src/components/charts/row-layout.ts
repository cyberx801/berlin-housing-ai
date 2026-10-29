import { estimateLabelWidth, STAMP_SPACE } from "./chart-parts";

// Shared geometry for charts with one row per category (BarChart, DotPlot). Wide charts put the
// label in a left column; narrow ones stack it above the mark, so long Bezirk names never clip.

export const ROW_HEIGHT = 44;
export const ROWS_TOP = STAMP_SPACE + 8;
const AXIS_SPACE = 28;
const MIN_PLOT_WIDTH = 220;

export function rowsHeight(rows: number): number {
  return ROWS_TOP + rows * ROW_HEIGHT + AXIS_SPACE;
}

export interface RowLayout {
  stacked: boolean;
  /** Left edge and width of the plot area. */
  left: number;
  width: number;
  /** Bottom of the last row, where the axis sits. */
  bottom: number;
  /** Vertical centre of the mark in row `i`, and the label's baseline. */
  markY: (i: number) => number;
  labelY: (i: number) => number;
  thickness: number;
}

export function rowLayout(width: number, rows: number, labels: string[], rightSpace: number): RowLayout {
  const labelColumn = Math.max(...labels.map((l) => estimateLabelWidth(l, 13)), 0) + 12;
  const stacked = width - labelColumn - rightSpace < MIN_PLOT_WIDTH;
  const left = stacked ? 0 : labelColumn;
  const top = (i: number) => ROWS_TOP + i * ROW_HEIGHT;
  return {
    stacked,
    left,
    width: Math.max(10, width - left - rightSpace),
    bottom: ROWS_TOP + rows * ROW_HEIGHT,
    markY: (i) => top(i) + (stacked ? 29 : ROW_HEIGHT / 2),
    labelY: (i) => top(i) + (stacked ? 14 : ROW_HEIGHT / 2),
    thickness: stacked ? 14 : 20,
  };
}

/** The row under a pointer, or null outside the rows. */
export function rowAt(y: number, rows: number): number | null {
  const i = Math.floor((y - ROWS_TOP) / ROW_HEIGHT);
  return i >= 0 && i < rows ? i : null;
}
