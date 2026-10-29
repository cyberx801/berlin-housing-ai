import type { Metadata } from "next";
import { NeighborhoodDirectory } from "@/features/neighborhoods/NeighborhoodDirectory";
import { GEO_PROVENANCE, getBezirkOptions, getPlatePlaces } from "@/lib/data/geo";

export const metadata: Metadata = {
  title: "Neighborhoods",
  description:
    "All 97 Berlin Ortsteile from A to Z, with Bezirk, area and ring status from the official boundaries. Filter by Bezirk or ring status, or search by name.",
};

export default function NeighborhoodsPage() {
  return (
    <>
      <div className="page-grid pt-8 pb-8 md:pt-10">
        <div className="col-span-full flex flex-col gap-3">
          <h1 className="type-title-1 stretch-wide">Berlin&rsquo;s 97 Ortsteile</h1>
          <p className="type-prose text-ink-2">
            Every Ortsteil with its Bezirk, area and ring status, all computed from the official boundaries. Each one
            has a profile page with a locator map and the Ortsteile it borders.
          </p>
        </div>
      </div>
      <NeighborhoodDirectory places={getPlatePlaces()} bezirke={getBezirkOptions()} provenance={GEO_PROVENANCE} />
    </>
  );
}
