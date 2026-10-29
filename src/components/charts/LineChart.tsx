"use client";

import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { addMonths, formatIsoDate, formatMonthShort } from "@/lib/formatting/date";
import type { Provenance } from "@/types/provenance";
import { ChartFrame, TooltipRow, type ChartSize } from "./ChartFrame";
import { estimateLabelWidth, LineKey, ProvenanceStamp, SERIES_FILL, SERIES_STROKE, STAMP_SPACE, type SeriesSlot } from "./chart-parts";

export interface LineSeries {
  key: string;
  label: string;
  /** Assigned by the caller and kept per entity, so filters never repaint a survivor. */
  slot: SeriesSlot;
  values: (number | null)[];
}

interface LineChartProps {
  label: string;
  provenance: Provenance;
  /** "YYYY-MM" of the first value. */
  firstMonth: string;
  series: LineSeries[];
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  className?: string;
}

const MARGIN = { top: STAMP_SPACE + 10, bottom: 28, left: 52 };
const END_LABEL_GAP = 8;
const MIN_LABEL_SPACING = 15;

/** Monthly lines with a crosshair, one y-axis, gaps where a month has no value. */
export function LineChart({
  label,
  provenance,
  firstMonth,
  series,
  formatValue,
  formatTick,
  className = "h-64 md:h-80",
}: LineChartProps) {
  const months = Math.max(0, ...series.map((s) => s.values.length));
  const monthAt = (i: number) => addMonths(firstMonth, i);
  const readout = (i: number) =>
    series.map((s) => {
      const v = s.values[i];
      return { series: s, text: v === null || v === undefined ? "No listings" : formatValue(v) };
    });

  const layout = (size: ChartSize) => {
    const multi = series.length > 1;
    // End labels: names for several lines, the last value for one. Dropped on narrow charts.
    const endTexts = series.map((s) => {
      const lastValue = [...s.values].reverse().find((v): v is number => v !== null);
      return multi ? s.label : lastValue !== undefined ? formatValue(lastValue) : "";
    });
    const endSpace = Math.max(...endTexts.map((t) => estimateLabelWidth(t)), 0) + END_LABEL_GAP + 4;
    const withEndLabels = size.width >= 480 && endSpace < size.width * 0.3;
    const right = withEndLabels ? endSpace : 16;
    const innerWidth = Math.max(10, size.width - MARGIN.left - right);
    const innerHeight = Math.max(10, size.height - MARGIN.top - MARGIN.bottom);
    const values = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
    const lo = values.length ? Math.min(...values) : 0;
    const hi = values.length ? Math.max(...values) : 1;
    const pad = (hi - lo || 1) * 0.08;
    const y = scaleLinear().domain([lo - pad, hi + pad]).nice(5).range([innerHeight, 0]);
    const x = scaleLinear().domain([0, Math.max(1, months - 1)]).range([0, innerWidth]);
    return { x, y, innerWidth, innerHeight, withEndLabels, endTexts };
  };

  return (
    <ChartFrame
      label={label}
      count={months}
      className={className}
      valueText={(i) =>
        `${formatIsoDate(monthAt(i))}: ${readout(i)
          .map((r) => (series.length > 1 ? `${r.series.label} ${r.text}` : r.text))
          .join(", ")}`
      }
      indexAt={({ x }, size) => {
        const { x: scale } = layout(size);
        const i = Math.round(scale.invert(x - MARGIN.left));
        return Math.max(0, Math.min(months - 1, i));
      }}
      tooltip={(i, size) => {
        const { x, y } = layout(size);
        const top = Math.min(...series.map((s) => s.values[i]).filter((v): v is number => v != null).map((v) => y(v)));
        return {
          x: MARGIN.left + x(i),
          y: MARGIN.top + (Number.isFinite(top) ? top : 0),
          content: (
            <>
              <div className="mb-1 text-ink-2">{formatIsoDate(monthAt(i))}</div>
              {readout(i).map((r) => (
                <TooltipRow
                  key={r.series.key}
                  swatch={series.length > 1 ? <LineKey slot={r.series.slot} className="self-center" /> : undefined}
                  value={r.text}
                  label={series.length > 1 ? r.series.label : undefined}
                />
              ))}
            </>
          ),
        };
      }}
    >
      {({ size, active }) => {
        const { x, y, innerWidth, innerHeight, withEndLabels, endTexts } = layout(size);
        const yTicks = y.ticks(5);
        const xTicks = monthTicks(firstMonth, months, innerWidth);
        const path = line<number | null>()
          .defined((v) => v !== null)
          .x((_, i) => x(i))
          .y((v) => y(v ?? 0));
        const ends = withEndLabels ? placeEndLabels(series, endTexts, y) : [];
        return (
          <svg width={size.width} height={size.height} aria-hidden="true" className="block overflow-visible">
            <ProvenanceStamp provenance={provenance} />
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              {yTicks.map((t) => (
                <g key={t} transform={`translate(0,${y(t)})`}>
                  <line x2={innerWidth} className="stroke-rule" />
                  <text x={-8} dy="0.32em" textAnchor="end" className="fill-ink-3 type-label tabular">
                    {formatTick(t)}
                  </text>
                </g>
              ))}
              <line y1={innerHeight} y2={innerHeight} x2={innerWidth} className="stroke-line-strong" />
              {xTicks.map((t) => (
                <g key={t.index} transform={`translate(${x(t.index)},${innerHeight})`}>
                  <line y2={5} className="stroke-line-strong" />
                  <text y={19} textAnchor="middle" className="fill-ink-3 type-label tabular">
                    {t.label}
                  </text>
                </g>
              ))}
              {series.map((s) => (
                <g key={s.key}>
                  <path
                    d={path(s.values) ?? undefined}
                    fill="none"
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    data-series={s.slot}
                    className={SERIES_STROKE[s.slot]}
                  />
                  {/* A month with no neighbours on either side would otherwise draw nothing. */}
                  {s.values.map((v, i) =>
                    v !== null && s.values[i - 1] == null && s.values[i + 1] == null ? (
                      <circle key={i} cx={x(i)} cy={y(v)} r={3} className={SERIES_FILL[s.slot]} />
                    ) : null,
                  )}
                </g>
              ))}
              {ends.map((end) => (
                <text
                  key={end.key}
                  x={innerWidth + END_LABEL_GAP}
                  y={end.y}
                  dy="0.32em"
                  className="fill-ink-2 type-label tabular"
                >
                  {end.text}
                </text>
              ))}
              {active !== null ? (
                <g>
                  <line x1={x(active)} x2={x(active)} y2={innerHeight} className="stroke-ink-3" />
                  {series.map((s) => {
                    const v = s.values[active];
                    return v === null || v === undefined ? null : (
                      <circle
                        key={s.key}
                        cx={x(active)}
                        cy={y(v)}
                        r={4.5}
                        strokeWidth={2}
                        className={`${SERIES_FILL[s.slot]} stroke-sheet`}
                      />
                    );
                  })}
                </g>
              ) : null}
            </g>
          </svg>
        );
      }}
    </ChartFrame>
  );
}

/** Yearly ticks for long spans, quarterly ones (labelled with the year in January) for short. */
function monthTicks(firstMonth: string, months: number, width: number): { index: number; label: string }[] {
  const firstMonthNumber = Number(firstMonth.slice(5, 7));
  const ticks: { index: number; label: string }[] = [];
  const quarterly = months <= 24;
  for (let i = 0; i < months; i += 1) {
    const month = ((firstMonthNumber - 1 + i) % 12) + 1;
    const key = addMonths(firstMonth, i);
    if (month === 1) ticks.push({ index: i, label: key.slice(0, 4) });
    else if (quarterly && (month - 1) % 3 === 0) ticks.push({ index: i, label: formatMonthShort(key) });
  }
  // Thin the labels until they fit (about 44 px each).
  const step = Math.max(1, Math.ceil((ticks.length * 44) / Math.max(1, width)));
  return ticks.filter((_, i) => i % step === 0);
}

/** Direct labels at the line ends, skipping any that would collide (the legend still names them). */
function placeEndLabels(
  series: LineSeries[],
  texts: string[],
  y: (v: number) => number,
): { key: string; y: number; text: string }[] {
  const candidates = series
    .map((s, i) => {
      const last = [...s.values].reverse().find((v): v is number => v !== null);
      return last === undefined ? null : { key: s.key, y: y(last), text: texts[i] ?? "" };
    })
    .filter((c): c is { key: string; y: number; text: string } => c !== null)
    .sort((a, b) => a.y - b.y);
  const placed: typeof candidates = [];
  for (const c of candidates) {
    if (placed.every((p) => Math.abs(p.y - c.y) >= MIN_LABEL_SPACING)) placed.push(c);
  }
  return placed;
}
