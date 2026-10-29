"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart } from "@/components/charts/BarChart";
import { ChartLegend } from "@/components/charts/ChartLegend";
import { DotPlot } from "@/components/charts/DotPlot";
import { Histogram, type HistogramBin } from "@/components/charts/Histogram";
import { LineChart, type LineSeries } from "@/components/charts/LineChart";
import { TableView } from "@/components/charts/TableView";
import type { SeriesSlot } from "@/components/charts/chart-parts";
import { Plate } from "@/components/provenance/Plate";
import { Button } from "@/components/ui/Button";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { cx } from "@/lib/cx";
import { addMonths, formatIsoDate } from "@/lib/formatting/date";
import { formatEUR, formatEURPerM2, formatNumber, formatPercent } from "@/lib/formatting/number";
import { PROPERTY_TYPE_LABELS } from "@/lib/property/labels";
import type { MarketFilter } from "@/lib/market/query";
import type { DistrictValue, PriceHistogram, TrendResult, TypeValue } from "@/types/market";
import type { Provenance } from "@/types/provenance";
import { distributionScope, districtScope, namesText, trendScope, typePlural, typesScope } from "./scope";
import { ModuleBoundary } from "./ModuleBoundary";
import type { ModuleData } from "./use-market-data";

export const MODULE_IDS = {
  trend: "market-trend",
  districts: "market-districts",
  distribution: "market-distribution",
  types: "market-types",
} as const;

const NNBSP = " ";
const NO_LISTINGS = "No listings";
const listings = (n: number) => `${formatNumber(n)} ${n === 1 ? "listing" : "listings"}`;
const priceRange = (x0: number, x1: number) => `${formatEUR(x0)}–${formatNumber(x1)}${NNBSP}/m²`;

export interface ModuleContext {
  filter: MarketFilter;
  /** Bezirk code → name. */
  names: ReadonlyMap<string, string>;
  /** Bezirk code → color slot, for the chosen Bezirke. */
  slots: ReadonlyMap<string, SeriesSlot>;
  onShowAllTypes: () => void;
  onReset: () => void;
}

const chosenNames = (ctx: ModuleContext) => ctx.filter.bezirke.map((code) => ctx.names.get(code) ?? code);
const scopeInput = (ctx: ModuleContext) => ({ ...ctx.filter, names: chosenNames(ctx) });

// ---------- Shell, empty and error states ----------

function MethodNote({ children }: { children: ReactNode }) {
  return (
    <p className="max-w-[68ch]">
      {children}{" "}
      <Link
        href="/methodology#market-data"
        className="underline decoration-line-strong underline-offset-4 hover:decoration-ink"
      >
        How this is calculated
      </Link>
    </p>
  );
}

function ModuleShell<T>({
  id,
  title,
  scope,
  data,
  note,
  children,
}: {
  id: string;
  title: string;
  scope: string;
  data: ModuleData<T>;
  note: ReactNode;
  children: ReactNode;
}) {
  const loading = data.status === "loading";
  return (
    <Plate id={id} title={title} provenance={data.response.provenance} caption={<MethodNote>{note}</MethodNote>}>
      <p className="mb-4 max-w-[68ch] type-small text-ink-2" data-module-scope>
        {scope}
      </p>
      {data.status === "error" ? (
        <StatusPanel
          tone="error"
          titleAs="h3"
          title="This chart couldn't load"
          actions={
            <Button variant="secondary" size="sm" onClick={data.retry}>
              Try again
            </Button>
          }
        >
          <p>The request for its data failed. The other charts on this page are not affected.</p>
        </StatusPanel>
      ) : (
        <div aria-busy={loading} data-module-status={data.status} className={cx("transition-state", loading && "opacity-50")}>
          <ModuleBoundary resetKey={scope}>{children}</ModuleBoundary>
        </div>
      )}
    </Plate>
  );
}

function EmptyState({ provenance, ctx }: { provenance: Provenance; ctx: ModuleContext }) {
  const filtered = ctx.filter.type !== "all";
  return (
    <StatusPanel
      tone="empty"
      titleAs="h3"
      title={provenance.kind === "demo" ? "No demo series for this combination" : "No data for this combination"}
      actions={
        <>
          {filtered ? (
            <Button variant="secondary" size="sm" onClick={ctx.onShowAllTypes}>
              Show all property types
            </Button>
          ) : null}
          <Button variant="quiet" onClick={ctx.onReset}>
            Reset filters
          </Button>
        </>
      }
    >
      <p>
        {provenance.kind === "demo"
          ? "The demo fixtures leave a few Bezirk and property type combinations empty on purpose, so this state can be seen and tested. It says nothing about which homes exist where."
          : "The source has no listings for these filters in this period."}
      </p>
    </StatusPanel>
  );
}

// ---------- Rent trend ----------

export function TrendModule({ data, ctx }: { data: ModuleData<TrendResult>; ctx: ModuleContext }) {
  const { provenance, data: trend } = data.response;
  const series: LineSeries[] = trend.series.map((s, i) => ({
    key: s.key,
    label: s.key === "berlin" ? "All of Berlin" : (ctx.names.get(s.key) ?? s.key),
    slot: s.key === "berlin" ? 1 : (ctx.slots.get(s.key) ?? (((i % 4) + 1) as SeriesSlot)),
    values: s.values,
  }));
  const missing = trend.missing.filter((key) => key !== "berlin").map((key) => ctx.names.get(key) ?? key);
  const months = Math.max(0, ...series.map((s) => s.values.length));
  const rows = Array.from({ length: months }, (_, i) => i);

  return (
    <ModuleShell
      id={MODULE_IDS.trend}
      title="How has the median asking rent per m² moved?"
      scope={trendScope(scopeInput(ctx))}
      data={data}
      note="Each point is the median asking rent per m² of that month's listings. A month without listings leaves a gap in its line."
    >
      {series.length === 0 ? (
        <EmptyState provenance={provenance} ctx={ctx} />
      ) : (
        <>
          {missing.length > 0 ? (
            <p className="mb-3 type-small font-[560] text-ink">
              No {provenance.kind === "demo" ? "demo " : ""}series for {namesText(missing)} with{" "}
              {typePlural(ctx.filter.type)} in this period.
            </p>
          ) : null}
          <ChartLegend items={series} label="Lines" />
          <LineChart
            label="Median asking rent per m², by month"
            provenance={provenance}
            firstMonth={trend.firstMonth}
            series={series}
            formatValue={formatEURPerM2}
            formatTick={formatEUR}
          />
          <TableView
            caption={`Median asking rent per m² by month. ${trendScope(scopeInput(ctx))}`}
            provenance={provenance}
            rows={rows}
            rowKey={(i) => String(i)}
            columns={[
              { key: "month", header: "Month", cell: (i) => formatIsoDate(addMonths(trend.firstMonth, i)) },
              ...series.map((s) => ({
                key: s.key,
                header: s.label,
                numeric: true,
                cell: (i: number) => {
                  const v = s.values[i];
                  return v === null || v === undefined ? NO_LISTINGS : formatEURPerM2(v);
                },
              })),
            ]}
          />
        </>
      )}
    </ModuleShell>
  );
}

// ---------- District comparison ----------

export function DistrictModule({ data, ctx }: { data: ModuleData<DistrictValue[]>; ctx: ModuleContext }) {
  const { provenance, data: districts } = data.response;
  const chosen = new Set(ctx.filter.bezirke);
  const rows = [...districts]
    .sort((a, b) => (b.median ?? -1) - (a.median ?? -1))
    .map((d) => ({
      key: d.code,
      label: ctx.names.get(d.code) ?? d.code,
      value: d.median,
      emphasis: chosen.has(d.code),
      detail: listings(d.listings),
      listings: d.listings,
    }));

  return (
    <ModuleShell
      id={MODULE_IDS.districts}
      title="How do the 12 Bezirke compare on asking rent per m²?"
      scope={districtScope(scopeInput(ctx))}
      data={data}
      note="Each bar is the median asking rent per m² of all listings in the period. Bars start at zero and use one color; chosen Bezirke get an outline and the word “selected”."
    >
      {rows.every((r) => r.value === null) ? (
        <EmptyState provenance={provenance} ctx={ctx} />
      ) : (
        <>
          <BarChart
            label="Median asking rent per m², by Bezirk"
            provenance={provenance}
            rows={rows}
            formatValue={formatEURPerM2}
            formatTick={formatEUR}
            emptyLabel={NO_LISTINGS}
          />
          <TableView
            caption={`Median asking rent per m² by Bezirk, highest first. ${districtScope(scopeInput(ctx))}`}
            provenance={provenance}
            rows={rows}
            rowKey={(r) => r.key}
            columns={[
              { key: "bezirk", header: "Bezirk", cell: (r) => r.label },
              {
                key: "median",
                header: "Median per m²",
                numeric: true,
                cell: (r) => (r.value === null ? NO_LISTINGS : formatEURPerM2(r.value)),
              },
              { key: "listings", header: "Listings", numeric: true, cell: (r) => formatNumber(r.listings) },
              { key: "selected", header: "Selected", cell: (r) => (r.emphasis ? "Yes" : "") },
            ]}
          />
        </>
      )}
    </ModuleShell>
  );
}

// ---------- Price distribution ----------

/** Drops empty bins at both ends so the columns use the width. */
function trimBins(h: PriceHistogram): HistogramBin[] {
  const bins = h.counts.map((count, i) => ({ x0: h.binMin + i * h.binWidth, x1: h.binMin + (i + 1) * h.binWidth, count }));
  const first = bins.findIndex((b) => b.count > 0);
  const last = bins.findLastIndex((b) => b.count > 0);
  return first === -1 ? [] : bins.slice(first, last + 1);
}

export function DistributionModule({ data, ctx }: { data: ModuleData<PriceHistogram>; ctx: ModuleContext }) {
  const { provenance, data: histogram } = data.response;
  const bins = trimBins(histogram);
  const share = (n: number) => (histogram.total > 0 ? n / histogram.total : 0);

  return (
    <ModuleShell
      id={MODULE_IDS.distribution}
      title="How are asking rents per m² spread across listings?"
      scope={distributionScope(scopeInput(ctx))}
      data={data}
      note="Each column is the share of the period's listings in a €2 band of asking rent per m². The dark rule marks the median."
    >
      {histogram.total === 0 ? (
        <EmptyState provenance={provenance} ctx={ctx} />
      ) : (
        <>
          <Histogram
            label="Share of listings by asking rent per m²"
            provenance={provenance}
            bins={bins}
            total={histogram.total}
            median={histogram.median}
            formatRange={priceRange}
            formatValue={formatEURPerM2}
            formatTick={formatEUR}
            formatShare={(s) => formatPercent(s, 1)}
            formatCount={listings}
          />
          <TableView
            caption={`Listings by asking rent per m², in €2 bands. ${distributionScope(scopeInput(ctx))}${
              histogram.median === null ? "" : ` Median ${formatEURPerM2(histogram.median)}.`
            }`}
            provenance={provenance}
            rows={bins}
            rowKey={(b) => String(b.x0)}
            columns={[
              { key: "band", header: "Asking rent per m²", cell: (b) => priceRange(b.x0, b.x1) },
              { key: "share", header: "Share of listings", numeric: true, cell: (b) => formatPercent(share(b.count), 1) },
              { key: "listings", header: "Listings", numeric: true, cell: (b) => formatNumber(b.count) },
            ]}
          />
        </>
      )}
    </ModuleShell>
  );
}

// ---------- Property types ----------

export function TypesModule({ data, ctx }: { data: ModuleData<TypeValue[]>; ctx: ModuleContext }) {
  const { provenance, data: types } = data.response;
  const rows = types.map((t) => ({
    key: t.type,
    label: PROPERTY_TYPE_LABELS[t.type],
    value: t.median,
    low: t.q1,
    high: t.q3,
    emphasis: ctx.filter.type === t.type,
    detail: listings(t.listings),
    listings: t.listings,
  }));
  const price = (v: number | null) => (v === null ? NO_LISTINGS : formatEURPerM2(v));

  return (
    <ModuleShell
      id={MODULE_IDS.types}
      title="How do property types compare on asking rent per m²?"
      scope={typesScope(scopeInput(ctx))}
      data={data}
      note="Each dot is a property type's median asking rent per m² over the period; the band behind it spans the middle half of its listings. The type filter doesn't narrow this chart: it compares all types."
    >
      {rows.every((r) => r.listings === 0) ? (
        <EmptyState provenance={provenance} ctx={ctx} />
      ) : (
        <>
          <p className="mb-2 flex flex-wrap gap-x-5 gap-y-1 type-small text-ink">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="size-3 rounded-full bg-series-1" />
              Median
            </span>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="h-1.5 w-6 rounded-full bg-seq-2" />
              Middle half of listings (25th to 75th percentile)
            </span>
          </p>
          <DotPlot
            label="Median asking rent per m², by property type"
            provenance={provenance}
            rows={rows}
            formatValue={formatEURPerM2}
            formatTick={formatEUR}
            rangeLabel="middle half"
            emptyLabel={NO_LISTINGS}
          />
          <TableView
            caption={`Asking rent per m² by property type. ${typesScope(scopeInput(ctx))}`}
            provenance={provenance}
            rows={rows}
            rowKey={(r) => r.key}
            columns={[
              { key: "type", header: "Property type", cell: (r) => r.label },
              { key: "median", header: "Median per m²", numeric: true, cell: (r) => price(r.value) },
              { key: "q1", header: "25th percentile", numeric: true, cell: (r) => price(r.low) },
              { key: "q3", header: "75th percentile", numeric: true, cell: (r) => price(r.high) },
              { key: "listings", header: "Listings", numeric: true, cell: (r) => formatNumber(r.listings) },
            ]}
          />
        </>
      )}
    </ModuleShell>
  );
}
