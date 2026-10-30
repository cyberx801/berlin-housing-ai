import type { Metadata } from "next";
import Link from "next/link";
import { BezirkMultiples } from "@/components/maps/BezirkMultiples";
import { LocatorPlate } from "@/components/maps/LocatorPlate";
import { RingPlate, ringPlateViewBox } from "@/components/maps/RingPlate";
import { RingPlateExplorer } from "@/components/maps/RingPlateExplorer";
import { Plate } from "@/components/provenance/Plate";
import { ProvenanceLabel } from "@/components/provenance/ProvenanceLabel";
import { ButtonLink } from "@/components/ui/Button";
import { DataTruthLedger } from "@/features/home/DataTruthLedger";
import { ToolsLedger } from "@/features/home/ToolsLedger";
import { AnalysisEntry } from "@/features/property-analysis/AnalysisEntry";
import {
  GEO_PROVENANCE,
  getBezirk,
  getBezirkOptions,
  getBezirke,
  getOrtsteil,
  getOrtsteilBySlug,
  getOrtsteile,
  getPlatePlaces,
  getPlates,
} from "@/lib/data/geo";
import { rentModelConnected } from "@/lib/api/prediction/connected";
import { formatKm2, formatRingShare } from "@/lib/formatting/number";
import { RING_STATUS_LABELS } from "@/lib/property/labels";

export const metadata: Metadata = {
  title: { absolute: "Berlin Housing AI" },
};

// The example Ortsteil for the explorer preview. Any of the 97 works; Moabit straddles the ring.
const PREVIEW_SLUG = "moabit";

// The first-page menu: every page, in the header's order, with what it is for.
const PAGES = [
  { href: "/analyze", name: "Analyze", summary: rentModelConnected ? "Describe a flat and try the demo rent model." : "Describe a flat and prepare it for the rent model." },
  { href: "/explore", name: "Explore", summary: "Map of the 97 Ortsteile and the S-Bahn ring." },
  { href: "/market", name: "Market", summary: "Charts of rents by district. Generated data." },
  { href: "/neighborhoods", name: "Neighborhoods", summary: "Boundaries and 2022 census rents for each Ortsteil." },
  { href: "/compare", name: "Compare", summary: "Set up to three listings side by side." },
  { href: "/methodology", name: "Methodology", summary: "Where every number comes from." },
] as const;

export default function HomePage() {
  const plates = getPlates();
  const places = getPlatePlaces();
  const ortsteile = getOrtsteile();
  const { width, height } = ringPlateViewBox(plates);
  const ringCounts = { inside: 0, partly: 0, outside: 0 };
  for (const o of ortsteile) ringCounts[o.ringStatus] += 1;

  const bezirkTiles = getBezirke().map((b) => ({
    code: b.code,
    name: b.name,
    slug: b.slug,
    areaKm2: b.areaKm2,
    ortsteilCount: b.ortsteilCodes.length,
    bbox: b.bbox,
  }));

  const preview = getOrtsteilBySlug(PREVIEW_SLUG);
  if (!preview) throw new Error(`Preview Ortsteil ${PREVIEW_SLUG} missing from geodata`);
  const previewBezirk = getBezirk(preview.bezirkCode);
  const previewNeighbors = preview.neighbors
    .map((code) => getOrtsteil(code))
    .filter((o) => o !== undefined)
    .sort((a, b) => a.name.localeCompare(b.name, "de"));

  return (
    <>
      <section aria-labelledby="home-title" className="overflow-x-clip">
        {/* lg: row 1 = the title's height, row 2 takes the rest of the plate's height. */}
        <div className="page-grid gap-y-10 pt-10 pb-16 lg:grid-rows-[auto_1fr] lg:pt-14 lg:pb-24">
          <div className="col-span-4 flex flex-col gap-6 md:col-span-8 lg:col-span-5 lg:col-start-1 lg:row-start-1">
            <h1 id="home-title" className="type-display-1">
              Read a Berlin flat against its city.
            </h1>
            <p className="type-prose max-w-[40ch] text-ink-2">
              A study project. It maps Berlin&rsquo;s 97 Ortsteile from official boundaries and lets you set up to
              three listings side by side. The market charts and the rent model use generated data, and each page
              says so.
            </p>
            <nav aria-label="Pages on this site">
              <h2 className="type-small font-[640] text-ink-2">Pages</h2>
              <ul className="mt-2 border-t border-ink">
                {PAGES.map((page) => (
                  <li
                    key={page.href}
                    className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 border-b border-rule py-2 type-small sm:grid-cols-[9rem_minmax(0,1fr)]"
                  >
                    <Link href={page.href} className="font-[680] underline-offset-4">
                      {page.name}
                    </Link>
                    <span className="text-ink-2">{page.summary}</span>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <figure className="col-span-4 -mx-4 flex flex-col gap-4 bg-sheet px-4 pt-4 pb-6 md:col-span-8 md:-mx-6 md:px-6 lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1 lg:mx-0 lg:bleed-right lg:pr-8 lg:pl-8">
            <ProvenanceLabel provenance={GEO_PROVENANCE} />
            <RingPlateExplorer idPrefix="home-plate" width={width} height={height} places={places} drawsRing>
              <RingPlate
                idPrefix="home-plate"
                plates={plates}
                drawRing
                title="Berlin's 97 Ortsteile and the S-Bahn ring"
                description={`Map of Berlin's 12 Bezirke and 97 Ortsteile with the Umweltzone, the official area within the S-Bahn ring. ${ringCounts.inside} Ortsteile lie inside the ring, ${ringCounts.partly} partly, and ${ringCounts.outside} outside.`}
              />
            </RingPlateExplorer>
            <figcaption className="flex flex-col gap-3 border-t border-rule pt-3">
              <PlateKey />
              <p className="type-small text-ink-2">
                {ringCounts.inside} Ortsteile lie inside the ring, {ringCounts.partly} partly and{" "}
                {ringCounts.outside} outside, measured by area.{" "}
                <Link href="/methodology#ring" className="text-ink-2">
                  How ring status is measured
                </Link>
              </p>
            </figcaption>
          </figure>

          <div className="col-span-4 md:col-span-8 lg:col-span-5 lg:col-start-1 lg:row-start-2 lg:self-start">
            <AnalysisEntry bezirke={getBezirkOptions()} idPrefix="home-entry" />
          </div>
        </div>
      </section>

      <section aria-labelledby="tools-title" className="page-grid gap-y-6 py-16">
        <div className="col-span-4 md:col-span-8 lg:col-span-3">
          <h2 id="tools-title" className="type-title-1">
            What backs each page
          </h2>
          <p className="mt-3 max-w-[36ch] type-small text-ink-2">
            Each tool says whether its numbers are official, yours, demo, or not connected yet.
          </p>
        </div>
        <div className="col-span-4 md:col-span-8 lg:col-span-9">
          <ToolsLedger />
        </div>
      </section>

      <section aria-labelledby="bezirke-title" className="page-grid gap-y-6 py-16">
        <div className="col-span-4 md:col-span-8 lg:col-span-3">
          <h2 id="bezirke-title" className="type-title-1">
            Twelve Bezirke, one scale
          </h2>
          <p className="mt-3 max-w-[36ch] type-small text-ink-2">
            Berlin&rsquo;s boroughs drawn to the same scale, with the Ortsteile inside each. Choose one to list its
            Ortsteile.
          </p>
          <ProvenanceLabel provenance={GEO_PROVENANCE} showDetail={false} className="mt-4" />
        </div>
        <div className="col-span-4 md:col-span-8 lg:col-span-9">
          <BezirkMultiples plates={plates} bezirke={bezirkTiles} />
        </div>
      </section>

      <section aria-label="Explorer preview" className="page-grid gap-y-6 py-16">
        <Plate
          id="home-preview"
          title={`${preview.name}, read against its neighbors`}
          provenance={GEO_PROVENANCE}
          className="col-span-4 md:col-span-8 lg:col-span-12"
          bodyClassName="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]"
          actions={
            <>
              <ButtonLink href={`/explore?o=${preview.slug}`} variant="secondary" size="sm">
                Open {preview.name} on the map
              </ButtonLink>
              <ButtonLink href={`/neighborhoods/${preview.slug}`} variant="secondary" size="sm">
                Read the {preview.name} profile
              </ButtonLink>
            </>
          }
          caption="An example. Every Ortsteil has the same facts, computed from the official boundaries."
        >
          <LocatorPlate
            idPrefix="home-locator"
            plates={plates}
            focus={{ code: preview.code, name: preview.name, point: preview.labelPoint }}
            context={previewNeighbors.map((n) => ({ code: n.code, name: n.name, point: n.labelPoint }))}
            title={`Locator map of ${preview.name}`}
            description={`${preview.name} is marked. It borders ${previewNeighbors.map((n) => n.name).join(", ")}. The S-Bahn ring line crosses the map.`}
          />
          <dl className="grid content-start grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 type-body">
            <dt className="text-ink-2">Bezirk</dt>
            <dd>{previewBezirk?.name}</dd>
            <dt className="text-ink-2">Ortsteil number</dt>
            <dd className="tabular">{preview.code}</dd>
            <dt className="text-ink-2">Area</dt>
            <dd className="tabular">{formatKm2(preview.areaKm2)}</dd>
            <dt className="text-ink-2">Ring status</dt>
            <dd>
              {RING_STATUS_LABELS[preview.ringStatus]}{" "}
              <span className="text-ink-2">({formatRingShare(preview.ringShare)} of its area)</span>
            </dd>
            <dt className="text-ink-2">Borders</dt>
            <dd>
              <ul className="flex flex-wrap gap-x-3 gap-y-1">
                {previewNeighbors.map((n) => (
                  <li key={n.code}>
                    <Link href={`/neighborhoods/${n.slug}`}>{n.name}</Link>
                  </li>
                ))}
              </ul>
            </dd>
          </dl>
        </Plate>
      </section>

      <section aria-labelledby="truth-title" className="page-grid gap-y-6 py-16">
        <div className="col-span-4 md:col-span-8 lg:col-span-3">
          <h2 id="truth-title" className="type-title-1">
            What the data can and can&rsquo;t tell you
          </h2>
        </div>
        <div className="col-span-4 md:col-span-8 lg:col-span-9">
          <DataTruthLedger />
        </div>
      </section>
    </>
  );
}

function PlateKey() {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-2 type-small text-ink-2">
      <li className="flex items-center gap-2">
        <svg width="28" height="10" aria-hidden="true">
          <line x1="1" y1="5" x2="27" y2="5" stroke="var(--color-ink)" strokeWidth="2.5" />
        </svg>
        Umweltzone, the official area within the S-Bahn ring
      </li>
      <li className="flex items-center gap-2">
        <svg width="28" height="10" aria-hidden="true">
          <line x1="1" y1="5" x2="27" y2="5" stroke="var(--color-ink)" strokeWidth="1.5" />
        </svg>
        Bezirk border
      </li>
      <li className="flex items-center gap-2">
        <svg width="28" height="10" aria-hidden="true">
          <line x1="1" y1="5" x2="27" y2="5" stroke="var(--color-line-strong)" strokeWidth="1" />
        </svg>
        Ortsteil boundary
      </li>
      <li className="flex items-center gap-2">
        <span aria-hidden="true" className="block h-3 w-5 border-2 border-ink bg-marker" />
        Selected
      </li>
    </ul>
  );
}
