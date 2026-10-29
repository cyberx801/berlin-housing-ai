import type { Metadata } from "next";
import { RingPlate, ringPlateViewBox } from "@/components/maps/RingPlate";
import { ExploreView } from "@/features/neighborhood-explorer/ExploreView";
import { GEO_PROVENANCE, getBerlinBbox, getExploreBezirke, getExplorePlaces, getPlates } from "@/lib/data/geo";

export const metadata: Metadata = {
  title: "Explore the map",
  description:
    "Find any of Berlin's 97 Ortsteile on a map or in a list, filter by Bezirk and ring status, and see each one's area, ring status and bordering Ortsteile. Official geometry, no market figures.",
};

const PLATE_ID = "explore-plate";

export default function ExplorePage() {
  const plates = getPlates();
  return (
    <>
      <div className="page-grid pt-8 pb-5 md:pt-10">
        <div className="col-span-full flex flex-col gap-2">
          <h1 className="type-title-1 stretch-wide">Explore the 97 Ortsteile</h1>
          <p className="max-w-[68ch] type-body text-ink-2">
            Choose an Ortsteil in the list or on the map to see its Bezirk, area, ring status and bordering
            Ortsteile. Everything here comes from official geometry; there are no rent or market figures.
          </p>
        </div>
      </div>
      <ExploreView
        places={getExplorePlaces()}
        bezirke={getExploreBezirke()}
        berlinBbox={getBerlinBbox()}
        provenance={GEO_PROVENANCE}
        plateIdPrefix={PLATE_ID}
        plateSize={ringPlateViewBox(plates)}
        plate={
          <RingPlate
            idPrefix={PLATE_ID}
            plates={plates}
            title="Berlin's 97 Ortsteile"
            description="A static plate of the Ortsteile, the Bezirk borders and the ring, shown while the interactive map loads or when it can't run."
            className="block size-full"
          />
        }
      />
    </>
  );
}
