import { X } from "lucide-react";
import type { RefObject } from "react";
import { ProvenanceLabel } from "@/components/provenance/ProvenanceLabel";
import { Button, ButtonLink } from "@/components/ui/Button";
import { formatKm2, formatRingShare } from "@/lib/formatting/number";
import { RING_STATUS_LABELS } from "@/lib/property/labels";
import type { ExplorePlace } from "@/types/geo";
import type { Provenance } from "@/types/provenance";

interface PlaceDetailsProps {
  titleId: string;
  place: ExplorePlace | null;
  neighbors: readonly ExplorePlace[];
  hiddenByFilter: boolean;
  provenance: Provenance;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSelectNeighbor: (code: string) => void;
  onClose: () => void;
  onClearFilters: () => void;
}

/** The selected Ortsteil's verified facts (geometry derivations only) and where to go next. */
export function PlaceDetails({
  titleId,
  place,
  neighbors,
  hiddenByFilter,
  provenance,
  headingRef,
  onSelectNeighbor,
  onClose,
  onClearFilters,
}: PlaceDetailsProps) {
  if (!place) {
    return (
      <div className="flex flex-col gap-2 px-4 py-5 md:px-6">
        <h2 ref={headingRef} id={titleId} tabIndex={-1} className="type-title-3">
          No Ortsteil chosen yet
        </h2>
        <p className="max-w-[60ch] type-small text-ink-2">
          Choose one from the list or tap it on the map. Its Bezirk, area, ring status and bordering Ortsteile
          appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 border-t-[3px] border-ink px-4 pt-4 pb-6 md:px-6">
      <div className="flex items-start justify-between gap-3">
        <ProvenanceLabel provenance={provenance} showDetail={false} />
        <Button variant="quiet" icon={<X />} onClick={onClose} aria-keyshortcuts="Escape" className="shrink-0">
          Close
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <h2 ref={headingRef} id={titleId} tabIndex={-1} className="type-title-2 stretch-wide">
          {place.name}
        </h2>
        <p className="type-small text-ink-2">Ortsteil in {place.bezirkName}</p>
      </div>

      {hiddenByFilter ? (
        <div className="flex flex-col items-start gap-1.5 border-l-4 border-line-strong bg-paper px-3 py-2.5 type-small">
          <p>
            <span className="font-[650]">Hidden by the current filter.</span> It stays selected, but the list
            doesn&rsquo;t show it.
          </p>
          <Button variant="quiet" onClick={onClearFilters}>
            Clear filters
          </Button>
        </div>
      ) : null}

      <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-1.5 type-small">
        <dt className="text-ink-2">Bezirk</dt>
        <dd>{place.bezirkName}</dd>
        <dt className="text-ink-2">Area</dt>
        <dd className="tabular">{formatKm2(place.areaKm2)}</dd>
        <dt className="text-ink-2">Ring status</dt>
        <dd>{RING_STATUS_LABELS[place.ringStatus]}</dd>
        <dt className="text-ink-2">Area inside the ring</dt>
        <dd className="tabular">{formatRingShare(place.ringShare)}</dd>
      </dl>

      {neighbors.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <h3 className="type-small font-[650]">Bordering Ortsteile ({neighbors.length})</h3>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {neighbors.map((neighbor) => (
              <li key={neighbor.code}>
                <Button variant="quiet" onClick={() => onSelectNeighbor(neighbor.code)} className="type-small">
                  {neighbor.name}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col items-stretch gap-2">
        <ButtonLink variant="secondary" size="sm" href={`/analyze?bezirk=${place.bezirkSlug}&ortsteil=${place.slug}`}>
          Analyze a flat in {place.name}
        </ButtonLink>
        <ButtonLink variant="secondary" size="sm" href={`/neighborhoods/${place.slug}`}>
          Open the {place.name} profile
        </ButtonLink>
      </div>
    </div>
  );
}
