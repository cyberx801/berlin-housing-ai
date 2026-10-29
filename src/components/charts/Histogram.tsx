"use client";

import { scaleLinear } from "d3-scale";
import { cx } from "@/lib/cx";
import type { Provenance } from "@/types/provenance";
import { ChartFrame, TooltipRow, type ChartSize } from "./ChartFrame";
import { barPath, estimateLabelWidth, ProvenanceStamp, STAMP_SPACE } from "./chart-parts";

export interface HistogramBin {
  x0: number;
  x1: number;
  count: number;
}

interface HistogramProps {
  label: string;
  provenance: Provenance;
  bins: HistogramBin[];
  total: number;
  /** Drawn as a reference rule with a label. */
  median: number | null;
  formatRange: (x0: number, x1: number) => string;
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  formatShare: (share: number) => string;
  formatCount: (count: number) => string;
  className?: string;
}

const MARGIN = { top: STAMP_SPACE + 22, right: 12, bottom: 28, left: 44 };
const GAP = 2;

/** Columns of the share of listings per price band; adjacent columns keep a 2 px surface gap. */
export function Histogram({
  label,
  provenance,
  bins,
  total,
  median,
  formatRange,
  formatValue,
  formatTick,
  formatShare,
  formatCount,
  className = "h-64 md:h-72",
}: HistogramProps) {
  const share = (b: HistogramBin) => (total > 0 ? b.count / total : 0);
  const first = bins[0]?.x0 ?? 0;
  const end = bins[bins.length - 1]?.x1 ?? 1;

  const layout = (size: ChartSize) => {
    const innerWidth = Math.max(10, size.width - MARGIN.left - MARGIN.right);
    const innerHeight = Math.max(10, size.height - MARGIN.top - MARGIN.bottom);
    const x = scaleLinear().domain([first, end]).range([0, innerWidth]);
    const y = scaleLinear()
      .domain([0, Math.max(...bins.map(share), 0.01)])
      .nice(4)
      .range([innerHeight, 0]);
    return { x, y, innerWidth, innerHeight };
  };

  const describe = (b: HistogramBin) => `${formatShare(share(b))} of listings, ${formatCount(b.count)}`;

  return (
    <ChartFrame
      label={label}
      count={bins.length}
      className={className}
      initialIndex={Math.max(0, bins.findIndex((b) => median !== null && median >= b.x0 && median < b.x1))}
      valueText={(i) => {
        const b = bins[i];
        return b ? `${formatRange(b.x0, b.x1)}: ${describe(b)}` : "";
      }}
      indexAt={({ x }, size) => {
        const { x: scale } = layout(size);
        const value = scale.invert(x - MARGIN.left);
        const i = bins.findIndex((b) => value >= b.x0 && value < b.x1);
        return i === -1 ? (value < first ? 0 : bins.length - 1) : i;
      }}
      tooltip={(i, size) => {
        const b = bins[i];
        if (!b) return null;
        const { x, y } = layout(size);
        return {
          x: MARGIN.left + x((b.x0 + b.x1) / 2),
          y: MARGIN.top + y(share(b)),
          content: (
            <>
              <div className="mb-1 text-ink-2">{formatRange(b.x0, b.x1)}</div>
              <TooltipRow value={formatShare(share(b))} label="of listings" />
              <div className="text-ink-2">{formatCount(b.count)}</div>
            </>
          ),
        };
      }}
    >
      {({ size, active }) => {
        const { x, y, innerWidth, innerHeight } = layout(size);
        const yTicks = y.ticks(4);
        const step = Math.max(1, Math.ceil((((end - first) / 5) * 40) / innerWidth)) * 5;
        const xTicks = x.ticks().filter((t) => t % step === 0);
        const medianX = median === null ? null : x(median);
        const medianText = median === null ? "" : `Median ${formatValue(median)}`;
        const medianRight = medianX !== null && medianX + estimateLabelWidth(medianText) + 6 > innerWidth;
        return (
          <svg width={size.width} height={size.height} aria-hidden="true" className="block overflow-visible">
            <ProvenanceStamp provenance={provenance} />
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {yTicks.map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line x2={innerWidth} className="stroke-rule" />
                  <text x={-8} dy="0.32em" textAnchor="end" className="fill-ink-3 type-label tabular">
                    {formatShare(t)}
                  </text>
                </g>
              ))}
              {bins.map((b, i) => {
                const left = x(b.x0) + GAP / 2;
                const width = Math.max(1, x(b.x1) - x(b.x0) - GAP);
                const top = y(share(b));
                return b.count > 0 ? (
                  <path
                    key={b.x0}
                    d={barPath({ x: left, y: top, width, height: innerHeight - top }, "top")}
                    data-texture-fill=""
                    className={cx("fill-series-1", active === i && "opacity-80")}
                  />
                ) : null;
              })}
              <line y1={innerHeight} y2={innerHeight} x2={innerWidth} className="stroke-line-strong" />
              {xTicks.map((t) => (
                <g key={t} transform={`translate(${x(t)},${innerHeight})`}>
                  <line y2={5} className="stroke-line-strong" />
                  <text y={19} textAnchor="middle" className="fill-ink-3 type-label tabular">
                    {formatTick(t)}
                  </text>
                </g>
              ))}
              {medianX !== null ? (
                <g transform={`translate(${medianX},0)`}>
                  <line y1={-16} y2={innerHeight} strokeWidth={1.5} className="stroke-ink" />
                  <text
                    x={medianRight ? -6 : 6}
                    y={-6}
                    textAnchor={medianRight ? "end" : "start"}
                    className="fill-ink type-label tabular font-[650]"
                  >
                    {medianText}
                  </text>
                </g>
              ) : null}
              {active !== null && bins[active] ? (
                <rect
                  x={x(bins[active].x0)}
                  width={Math.max(1, x(bins[active].x1) - x(bins[active].x0))}
                  y={-16}
                  height={innerHeight + 16}
                  className="fill-ink opacity-[0.06]"
                />
              ) : null}
            </g>
          </svg>
        );
      }}
    </ChartFrame>
  );
}
