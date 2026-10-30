import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocatorPlate, locatorShowsRing } from "@/components/maps/LocatorPlate";
import { ProvenanceLabel } from "@/components/provenance/ProvenanceLabel";
import { ButtonLink } from "@/components/ui/Button";
import {
  CensusRentModule,
  CharacterModule,
  FactsLedger,
  MarketModule,
  NearbyTable,
  TransitModule,
} from "@/features/neighborhoods/ProfileSections";
import { bezirkPhrase, namesList, profileDescription } from "@/features/neighborhoods/profile-text";
import {
  GEO_PROVENANCE,
  getBezirk,
  getBezirkOptions,
  getNeighborhoodProfile,
  getOrtsteile,
  getPlates,
} from "@/lib/data/geo";
import { getMarketSource } from "@/lib/data/market";
import { getOrtsteilRent, ZENSUS_PROVENANCE, ZENSUS_RENT_META } from "@/lib/data/zensus";
import { createBezirkSlugs, defaultFilter, marketQuery } from "@/lib/market/query";

interface ProfilePageProps {
  params: Promise<{ slug: string }>;
}

// All 97 profiles are prerendered. `dynamicParams = false` isn't available with Cache Components,
// so any other slug renders on request and ends in notFound() (D-043).
export function generateStaticParams() {
  return getOrtsteile().map((o) => ({ slug: o.slug }));
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const profile = getNeighborhoodProfile((await params).slug);
  if (!profile) notFound();
  return {
    title: `${profile.place.name}, Ortsteil of ${bezirkPhrase(profile.place)}`,
    description: profileDescription(profile),
  };
}

export default async function NeighborhoodProfilePage({ params }: ProfilePageProps) {
  const profile = getNeighborhoodProfile((await params).slug);
  if (!profile) notFound();
  const { place, neighbors } = profile;
  const id = `profile-${place.slug}`;
  const plates = getPlates();
  const showsRing = locatorShowsRing(plates, [place.code, ...neighbors.map((n) => n.code)]);

  const rent = getOrtsteilRent(place.code);
  const market = getMarketSource();
  const marketHref = `/market${marketQuery(
    { ...defaultFilter(market.coverage), bezirke: [place.bezirkCode] },
    createBezirkSlugs(getBezirkOptions()),
    market.coverage,
  )}`;

  return (
    <>
      <div className="page-grid gap-y-8 pt-6 pb-6 md:pt-8 lg:items-start">
        <div className="col-span-4 flex flex-col gap-5 md:col-span-8 lg:col-span-7 lg:pt-6">
          <Link
            href="/neighborhoods"
            className="self-start type-small text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink"
          >
            All 97 Ortsteile
          </Link>
          <div className="flex flex-col gap-3">
            <h1 lang="de" className="type-display-1 hyphens-auto [overflow-wrap:anywhere]">
              {place.name}
            </h1>
            <p className="type-title-3 text-ink-2">An Ortsteil of {bezirkPhrase(place)}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={`/analyze?bezirk=${place.bezirkSlug}&ortsteil=${place.slug}`}>
              Analyze a flat in {place.name}
            </ButtonLink>
            <ButtonLink href={`/explore?o=${place.slug}`} variant="secondary">
              See {place.name} on the map
            </ButtonLink>
          </div>
        </div>
        <figure className="col-span-4 flex flex-col gap-3 border-t-[3px] border-ink bg-sheet px-4 pt-3 pb-4 md:col-span-8 lg:col-span-5 lg:row-span-2">
          <ProvenanceLabel provenance={GEO_PROVENANCE} showDetail={false} />
          <LocatorPlate
            idPrefix={`${id}-locator`}
            plates={plates}
            focus={{ code: place.code, name: place.name, point: place.labelPoint }}
            context={neighbors.map((n) => ({ code: n.code, name: n.name, point: n.labelPoint }))}
            title={`Locator map of ${place.name}`}
            description={`${place.name} is marked. It borders ${namesList(neighbors.map((n) => n.name))}.${showsRing ? " The S-Bahn ring line crosses the map." : ""}`}
          />
          <figcaption className="type-small text-ink-2">
            {place.name} is filled in yellow and outlined.{" "}
            {showsRing
              ? "The heavy line is the ring (Umweltzone); thinner ink lines are Bezirk borders and the city boundary."
              : "Thin ink lines are Bezirk borders and the city boundary. The ring lies outside this view."}
          </figcaption>
        </figure>
        <FactsLedger
          idPrefix={id}
          place={place}
          neighbors={neighbors}
          bezirkCount={getBezirk(place.bezirkCode)?.ortsteilCodes.length ?? 0}
          provenance={GEO_PROVENANCE}
          className="col-span-4 md:col-span-8 lg:col-span-7"
        />
      </div>

      <div className="page-grid gap-y-6 pt-4 pb-16">
        <NearbyTable
          idPrefix={id}
          place={place}
          neighbors={neighbors}
          provenance={GEO_PROVENANCE}
          className="col-span-4 md:col-span-8 lg:col-span-12"
        />
        {rent ? (
          <CensusRentModule
            idPrefix={id}
            place={place}
            provenance={ZENSUS_PROVENANCE}
            rent={rent}
            berlinMeanRentPerM2={ZENSUS_RENT_META.berlinMeanRentPerM2}
            minDwellings={ZENSUS_RENT_META.minDwellings}
            referenceYear={ZENSUS_RENT_META.referenceDate.slice(0, 4)}
            className="col-span-4 md:col-span-8 lg:col-span-12"
          />
        ) : null}
        <section aria-labelledby={`${id}-more-title`} className="col-span-4 flex flex-col gap-4 pt-6 md:col-span-8 lg:col-span-12">
          <h2 id={`${id}-more-title`} className="type-title-2 stretch-wide">
            What this page can&rsquo;t tell you yet
          </h2>
          <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
            <MarketModule idPrefix={id} place={place} provenance={market.provenance} marketHref={marketHref} />
            <TransitModule idPrefix={id} place={place} />
            <CharacterModule idPrefix={id} place={place} className="lg:col-span-2 xl:col-span-1" />
          </div>
        </section>
      </div>
    </>
  );
}
