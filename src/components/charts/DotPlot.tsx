"use client";

import { scaleLinear } from "d3-scale";
import { cx } from "@/lib/cx";
import type { Provenance } from "@/types/provenance";
import { ChartFrame, TooltipRow } from "./ChartFrame";
import { ProvenanceStamp } from "./chart-parts";
import { rowAt, rowLayout, rowsHeight } from "./row-layout";

export interface DotRow {
  key: string;
  label: string;
  /** The dot (e.g. the median). */
  value: number | null;
  /** The range behind it (e.g. the interquartile range). */
  low: number | null;
  high: number | null;
  emphasis?: boolean;
  detail?: string;
}

interface DotPlotProps {
  label: string;
  provenance: Provenance;
  rows: DotRow[];
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  /** Names the range in the readout, e.g. "Middle half". */
  rangeLabel: string;
  emptyLabel: string;
}

const RIGHT = 16;

/** One row per category: a dot on its range. Position on a shared axis, one hue. */
export function DotPlot({ label, provenance, rows, formatValue, formatTick, rangeLabel, emptyLabel }: DotPlotProps) {
  const height = rowsHeight(rows.length);
  const known = rows.flatMap((r) => [r.low, r.value, r.high].filter((v): v is number => v !== null));
  const lo = known.length ? Math.min(...known) : 0;
  const hi = known.length ? Math.max(...known) : 1;

  const layout = (width: number) => {
    const labels = rows.map((r) => (r.emphasis ? `${r.label}  selected` : r.label));
    const rl = rowLayout(width, rows.length, labels, RIGHT);
    const pad = (hi - lo || 1) * 0.06;
    const x = scaleLinear().domain([lo - pad, hi + pad]).nice(5).range([0, rl.width]);
    return { ...rl, x };
  };

  const describe = (r: DotRow) =>
    r.value === null
      ? emptyLabel
      : [
          formatValue(r.value),
          r.low !== null && r.high !== null ? `${rangeLabel} ${formatValue(r.low)} to ${formatValue(r.high)}` : null,
          r.detail,
          r.emphasis ? "selected" : null,
        ]
          .filter(Boolean)
          .join(", ");

  return (
    <ChartFrame
      label={label}
      count={rows.length}
      initialIndex={0}
      orientation="vertical"
      height={height}
      valueText={(i) => {
        const r = rows[i];
        return r ? `${r.label}, ${i + 1} of ${rows.length}: ${describe(r)}` : "";
      }}
      indexAt={({ y }) => rowAt(y, rows.length)}
      tooltip={(i, size) => {
        const r = rows[i];
        if (!r) return null;
        const l = layout(size.width);
        return {
          x: l.left + l.x(r.high ?? r.value ?? lo),
          y: l.markY(i) - 10,
          content: (
            <>
              <div className="mb-1 text-ink-2">{r.label}</div>
              <TooltipRow value={r.value === null ? emptyLabel : formatValue(r.value)} label={r.value === null ? undefined : "median"} />
              {r.low !== null && r.high !== null ? (
                <div className="text-ink-2">
                  {rangeLabel} {formatValue(r.low)} to {formatValue(r.high)}
                </div>
              ) : null}
              {r.detail ? <div className="text-ink-2">{r.detail}</div> : null}
              {r.emphasis ? <div className="font-[620]">Selected</div> : null}
            </>
          ),
        };
      }}
    >
      {({ size, active }) => {
        const l = layout(size.width);
        const ticks = l.x.ticks(5);
        return (
          <svg width={size.width} height={size.height} aria-hidden="true" className="block overflow-visible">
            <ProvenanceStamp provenance={provenance} />
            {ticks.map((t) => (
              <g key={t} transform={`translate(${l.left + l.x(t)},0)`}>
                <line y1={l.markY(0) - 18} y2={l.bottom} className="stroke-rule" />
                <text y={l.bottom + 18} textAnchor="middle" className="fill-ink-3 type-label tabular">
                  {formatTick(t)}
                </text>
              </g>
            ))}
            <line x1={l.left} x2={l.left + l.width} y1={l.bottom} y2={l.bottom} className="stroke-line-strong" />
            {rows.map((r, i) => {
              const cy = l.markY(i);
              return (
                <g key={r.key}>
                  <text
                    x={l.stacked ? 0 : l.left - 12}
                    y={l.labelY(i)}
                    dy={l.stacked ? 0 : "0.32em"}
                    textAnchor={l.stacked ? "start" : "end"}
                    className={cx("fill-ink type-label", r.emphasis && "font-[750]")}
                  >
                    {r.label}
                    {r.emphasis ? (
                      <tspan dx={6} className="font-[650]">
                        selected
                      </tspan>
                    ) : null}
                  </text>
                  {r.low !== null && r.high !== null ? (
                    <line
                      x1={l.left + l.x(r.low)}
                      x2={l.left + l.x(r.high)}
                      y1={cy}
                      y2={cy}
                      strokeWidth={6}
                      strokeLinecap="round"
                      className="stroke-seq-2"
                    />
                  ) : null}
                  {r.value !== null ? (
                    <circle
                      cx={l.left + l.x(r.value)}
                      cy={cy}
                      r={active === i ? 6.5 : 5.5}
                      strokeWidth={2}
                      data-emphasis={r.emphasis ? "" : undefined}
                      className={cx("fill-series-1", r.emphasis ? "stroke-ink" : "stroke-sheet")}
                    />
                  ) : (
                    <text
                      x={l.stacked ? 0 : l.left + 4}
                      y={cy}
                      dy="0.32em"
                      className="fill-ink-3 type-label"
                    >
                      {emptyLabel}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        );
      }}
    </ChartFrame>
  );
}
