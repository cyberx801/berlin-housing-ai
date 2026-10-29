"use client";

import { scaleLinear } from "d3-scale";
import { cx } from "@/lib/cx";
import type { Provenance } from "@/types/provenance";
import { ChartFrame, TooltipRow } from "./ChartFrame";
import { barPath, estimateLabelWidth, ProvenanceStamp } from "./chart-parts";
import { rowAt, rowLayout, rowsHeight } from "./row-layout";

export interface BarRow {
  key: string;
  label: string;
  value: number | null;
  /** Chosen by the reader: ink outline, bold label and the word "selected", never a new hue. */
  emphasis?: boolean;
  /** Second readout line, e.g. the listing count. */
  detail?: string;
}

interface BarChartProps {
  label: string;
  provenance: Provenance;
  /** Drawn top to bottom in the given order. */
  rows: BarRow[];
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  emptyLabel: string;
}

const VALUE_GAP = 8;
const SELECTED = "selected";

/** Horizontal bars from one baseline, one hue (DESIGN_SYSTEM §8.1 district comparison rule). */
export function BarChart({ label, provenance, rows, formatValue, formatTick, emptyLabel }: BarChartProps) {
  const height = rowsHeight(rows.length);
  const valueSpace =
    Math.max(
      ...rows.map((r) =>
        estimateLabelWidth(`${r.value === null ? emptyLabel : formatValue(r.value)}${r.emphasis ? `  ${SELECTED}` : ""}`),
      ),
      0,
    ) + VALUE_GAP;
  const max = Math.max(...rows.map((r) => r.value ?? 0), 0);
  const describe = (r: BarRow) =>
    [r.value === null ? emptyLabel : formatValue(r.value), r.detail, r.emphasis ? SELECTED : null].filter(Boolean).join(", ");

  const layout = (width: number) => {
    const rl = rowLayout(width, rows.length, rows.map((r) => r.label), valueSpace);
    const x = scaleLinear().domain([0, max || 1]).nice(4).range([0, rl.width]);
    return { ...rl, x };
  };

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
          x: l.left + l.x(r.value ?? 0),
          y: l.markY(i) - 10,
          content: (
            <>
              <div className="mb-1 text-ink-2">{r.label}</div>
              <TooltipRow value={r.value === null ? emptyLabel : formatValue(r.value)} />
              {r.detail ? <div className="text-ink-2">{r.detail}</div> : null}
              {r.emphasis ? <div className="font-[620]">Selected</div> : null}
            </>
          ),
        };
      }}
    >
      {({ size, active }) => {
        const l = layout(size.width);
        const ticks = l.x.ticks(4);
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
            {rows.map((r, i) => {
              const w = r.value === null ? 0 : l.x(r.value);
              const top = l.markY(i) - l.thickness / 2;
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
                  </text>
                  {r.value !== null ? (
                    <path
                      d={barPath({ x: l.left, y: top, width: Math.max(w, 1), height: l.thickness }, "right")}
                      strokeWidth={r.emphasis ? 2 : 0}
                      className={cx(
                        "fill-series-1",
                        r.emphasis ? "stroke-ink" : "stroke-transparent",
                        active === i && "opacity-80",
                      )}
                    />
                  ) : null}
                  <text x={l.left + w + VALUE_GAP} y={l.markY(i)} dy="0.32em" className="fill-ink-2 type-label tabular">
                    {r.value === null ? emptyLabel : formatValue(r.value)}
                    {r.emphasis ? (
                      <tspan dx={6} className="fill-ink font-[650]">
                        {SELECTED}
                      </tspan>
                    ) : null}
                  </text>
                </g>
              );
            })}
            <line x1={l.left} x2={l.left} y1={l.markY(0) - 18} y2={l.bottom} className="stroke-line-strong" />
          </svg>
        );
      }}
    </ChartFrame>
  );
}
