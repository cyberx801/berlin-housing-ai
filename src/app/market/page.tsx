import type { Metadata } from "next";
import Link from "next/link";
import { ProvenanceMark } from "@/components/provenance/ProvenanceMark";
import { PROVENANCE_COPY } from "@/components/provenance/provenance-copy";
import { MarketView } from "@/features/market-intelligence/MarketView";
import { getBezirkOptions } from "@/lib/data/geo";
import { getMarketSource, withProvenance } from "@/lib/data/market";
import { defaultFilter } from "@/lib/market/query";

// Titles and descriptions never carry market values (DATA_BOUNDARIES §5).
export const metadata: Metadata = {
  title: "Market dashboard",
  description:
    "Rent trend, Bezirk comparison, price distribution and property types in one dashboard, drawn from labeled demo data until a validated market dataset is connected.",
};

export default async function MarketPage() {
  const source = getMarketSource();
  const filter = defaultFilter(source.coverage);
  // The default view is rendered at build time; other filters are fetched from /api/market/* (D-022).
  const [trend, districts, distribution, types] = await Promise.all([
    withProvenance((s) => s.rentTrend(filter)),
    withProvenance((s) => s.districtComparison(filter)),
    withProvenance((s) => s.priceDistribution(filter)),
    withProvenance((s) => s.propertyTypeComparison(filter)),
  ]);

  return (
    <>
      <div className="page-grid gap-y-6 pt-8 pb-8 md:pt-10">
        <div className="col-span-full flex flex-col gap-3">
          <h1 className="type-title-1 stretch-wide">Market dashboard</h1>
          <p className="type-prose text-ink-2">
            Four views of asking rents per m²: over time, by Bezirk, across price bands and by property type. One
            set of filters applies to every chart, and each chart has a table view.
          </p>
        </div>
        {source.provenance.kind === "demo" ? (
          <section aria-labelledby="market-demo-title" className="col-span-full border border-line-strong bg-sheet">
            <div aria-hidden="true" className="band-hatch h-3 border-b border-line-strong" />
            <div className="flex flex-col gap-2 px-4 py-4 md:px-5">
              <h2 id="market-demo-title" className="flex items-center gap-3 type-title-3">
                <ProvenanceMark kind="demo" />
                {PROVENANCE_COPY.demo.label}
              </h2>
              <p className="max-w-[68ch] text-ink-2">
                Every chart and table on this page is drawn from synthetic listings made by a seeded generator, so the
                dashboard can be built and tested before a validated market dataset is connected. The Bezirk levels are
                random draws: none of these figures describe Berlin, and their order says nothing about real rents.
              </p>
              <p>
                <Link
                  href="/methodology#market-data"
                  className="type-small font-[600] underline decoration-line-strong underline-offset-4 hover:decoration-ink"
                >
                  How this is calculated
                </Link>
              </p>
            </div>
          </section>
        ) : null}
      </div>
      <MarketView
        bezirke={getBezirkOptions()}
        coverage={source.coverage}
        initial={{ trend, districts, distribution, types }}
      />
    </>
  );
}
