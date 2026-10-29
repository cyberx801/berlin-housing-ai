import Link from "next/link";
import { Plate } from "@/components/provenance/Plate";
import { ButtonLink } from "@/components/ui/Button";
import { formatKm2, formatPercent, formatRingShare } from "@/lib/formatting/number";
import { RING_INSIDE_MIN, RING_OUTSIDE_MAX } from "@/lib/geo/ring";
import { RING_STATUS_LABELS, RING_STATUS_SHORT } from "@/lib/property/labels";
import type { ExplorePlace } from "@/types/geo";
import type { Provenance } from "@/types/provenance";
import { bezirkPhrase } from "./profile-text";

// The profile modules (PRD E3). Facts and the nearby table come from the geodata build only;
// market, transit and character render their honest state and carry no figures or prose.

const linkClasses = "underline decoration-line-strong underline-offset-4 hover:decoration-ink";

interface PlaceProps {
  /** Page-unique id base: hidden routes stay mounted, so two profiles can share the DOM. */
  idPrefix: string;
  place: ExplorePlace;
  className?: string;
}

export function RingMethodNote() {
  return (
    <>
      Area is computed from the official boundary geometry. Ring status compares that area with the Umweltzone, the
      official area within the S-Bahn ring: inside means at least {formatPercent(RING_INSIDE_MIN)} of the area lies
      within it, outside means at most {formatPercent(RING_OUTSIDE_MAX)}, and partly is anything between.{" "}
      <Link href="/methodology#ring" className={linkClasses}>
        How this is calculated
      </Link>
    </>
  );
}

export function FactsLedger({
  idPrefix,
  place,
  className,
  neighbors,
  bezirkCount,
  provenance,
}: PlaceProps & { neighbors: readonly ExplorePlace[]; bezirkCount: number; provenance: Provenance }) {
  return (
    <Plate
      id={`${idPrefix}-facts`}
      className={className}
      title={`What the official boundaries say about ${place.name}`}
      provenance={provenance}
      caption={<RingMethodNote />}
    >
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3">
        <dt className="text-ink-2">Bezirk</dt>
        <dd className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span>{place.bezirkName}</span>
          <Link href={`/neighborhoods?bezirk=${place.bezirkSlug}`} className={`type-small ${linkClasses}`}>
            All {bezirkCount} Ortsteile of {bezirkPhrase(place)}
          </Link>
        </dd>
        <dt className="text-ink-2">Ortsteil number</dt>
        <dd className="tabular">{place.code}</dd>
        <dt className="text-ink-2">Area</dt>
        <dd className="tabular">{formatKm2(place.areaKm2)}</dd>
        <dt className="text-ink-2">Ring status</dt>
        <dd>
          {RING_STATUS_LABELS[place.ringStatus]}{" "}
          <span className="text-ink-2">
            (<span className="tabular">{formatRingShare(place.ringShare)}</span> of its area)
          </span>
        </dd>
        <dt className="text-ink-2">Borders</dt>
        <dd>
          <ul aria-label={`${neighbors.length} bordering Ortsteile`} className="flex flex-wrap gap-x-4 gap-y-1">
            {neighbors.map((n) => (
              <li key={n.code}>
                <Link href={`/neighborhoods/${n.slug}`} className={linkClasses}>
                  {n.name}
                </Link>
              </li>
            ))}
          </ul>
        </dd>
      </dl>
    </Plate>
  );
}

export function NearbyTable({
  idPrefix,
  place,
  className,
  neighbors,
  provenance,
}: PlaceProps & { neighbors: readonly ExplorePlace[]; provenance: Provenance }) {
  const rows = [place, ...neighbors];
  const crossesBezirke = neighbors.some((n) => n.bezirkCode !== place.bezirkCode);
  return (
    <Plate
      id={`${idPrefix}-nearby`}
      className={className}
      title={`How ${place.name} compares with the Ortsteile around it`}
      provenance={provenance}
      bodyClassName="px-0 md:px-0"
      caption={
        <>
          {place.name} first, then its bordering Ortsteile by name
          {crossesBezirke ? ", including those across the Bezirk border" : ""}. The same boundary data and ring method
          as above.
        </>
      }
    >
      <table className="w-full border-collapse text-left type-small md:type-body">
        <caption className="sr-only">
          {place.name} and its bordering Ortsteile: Bezirk, area and ring status
        </caption>
        <thead>
          <tr className="border-b border-ink">
            <th scope="col" className="stretch-condensed py-2 pr-3 pl-4 font-[620] md:w-[30%] md:pl-5">
              Ortsteil
            </th>
            <th scope="col" className="stretch-condensed hidden py-2 pr-3 font-[620] md:table-cell md:w-[30%]">
              Bezirk
            </th>
            <th scope="col" className="stretch-condensed py-2 pr-6 text-right font-[620] md:w-[14%]">
              Area
            </th>
            <th scope="col" className="stretch-condensed py-2 pr-4 font-[620] md:pr-5">
              Ring status
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const current = row.code === place.code;
            return (
              <tr key={row.code} className={current ? "border-b border-ink bg-paper" : "border-b border-rule"}>
                <th scope="row" className="py-2.5 pr-3 pl-4 align-top font-[450] md:pl-5">
                  {current ? (
                    <span className="font-[650]">
                      {row.name} <span className="font-[450] text-ink-2">(this Ortsteil)</span>
                    </span>
                  ) : (
                    <Link href={`/neighborhoods/${row.slug}`} className={linkClasses}>
                      {row.name}
                    </Link>
                  )}
                  <span className="block text-ink-2 md:hidden">{row.bezirkName}</span>
                </th>
                <td className="hidden py-2.5 pr-3 align-top md:table-cell">{row.bezirkName}</td>
                <td className="tabular py-2.5 pr-6 text-right align-top whitespace-nowrap">{formatKm2(row.areaKm2, true)}</td>
                <td className="py-2.5 pr-4 align-top md:pr-5">
                  {RING_STATUS_SHORT[row.ringStatus]}
                  <span className="block text-ink-2">
                    <span className="tabular">{formatRingShare(row.ringShare)}</span> inside
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Plate>
  );
}

export function MarketModule({
  idPrefix,
  place,
  className,
  provenance,
  marketHref,
}: PlaceProps & { provenance: Provenance; marketHref: string }) {
  return (
    <Plate
      id={`${idPrefix}-market`}
      className={className}
      titleAs="h3"
      title={`Is there market data for ${place.name}?`}
      provenance={provenance}
      bodyClassName="flex flex-col items-start gap-3"
    >
      <p className="max-w-[60ch]">
        Not for {place.name} itself. Market series on this site are kept by Bezirk, so the closest view is{" "}
        {bezirkPhrase(place)}.
      </p>
      {provenance.kind === "demo" ? (
        <p className="max-w-[60ch] type-small text-ink-2">
          Those series are demo data for now, so they don&rsquo;t describe {place.bezirkName} or any part of Berlin.
        </p>
      ) : null}
      <ButtonLink href={marketHref} variant="secondary" size="sm">
        See {place.bezirkName} on the market dashboard
      </ButtonLink>
    </Plate>
  );
}

export const TRANSIT_PROVENANCE: Provenance = {
  kind: "not-connected",
  missing: "No station dataset is registered yet",
};

export function TransitModule({ idPrefix, place, className }: PlaceProps) {
  return (
    <Plate
      id={`${idPrefix}-transit`}
      className={className}
      titleAs="h3"
      title={`How far is the nearest station from ${place.name}?`}
      provenance={TRANSIT_PROVENANCE}
    >
      <p className="max-w-[60ch]">
        This needs station locations from a dataset that has passed review. None is connected, so no distance is
        shown, and none is estimated.
      </p>
    </Plate>
  );
}

export const CHARACTER_PROVENANCE: Provenance = {
  kind: "pending",
  reason: "Descriptions are added only where each claim links to a citable source",
};

export function CharacterModule({ idPrefix, place, className }: PlaceProps) {
  return (
    <Plate
      id={`${idPrefix}-character`}
      className={className}
      titleAs="h3"
      title={`What is ${place.name} like?`}
      provenance={CHARACTER_PROVENANCE}
    >
      <p className="max-w-[60ch]">
        No description of {place.name} has been written. This page shows only what the official boundaries say, and
        it doesn&rsquo;t rate or rank places.
      </p>
    </Plate>
  );
}
