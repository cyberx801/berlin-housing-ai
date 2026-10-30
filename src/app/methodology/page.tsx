import type { Metadata } from "next";
import { MethodologyArticle } from "@/features/methodology/MethodologyArticle";
import { MethodologyContents } from "@/features/methodology/MethodologyContents";
import { formatPercent } from "@/lib/formatting/number";
import { GEO_PROVENANCE, getBezirk, getBezirke, getGeoBuildInfo, getOrtsteilBySlug, getOrtsteile } from "@/lib/data/geo";
import { getDatasetRegistry } from "@/lib/data/registry";
import { ZENSUS_RENT_META } from "@/lib/data/zensus";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "Where each figure on Berlin Housing AI comes from: the official geodata and how its facts are computed, the demo market data, your own entries, and what isn't connected yet.",
};

// The Ortsteile the copy uses as examples: the key of an ordinary one, and the one whose own
// area field is furthest from its geometry, with that field as the raw file has it (data/PROVENANCE.md).
const KEY_EXAMPLE = "moabit";
const AREA_EXAMPLE = { slug: "blankenfelde", ownFieldM2: 139 };

/** "1.6%" from the build rules → "1.6 %" in the site's number style. */
function percentText(rule: string) {
  const value = Number.parseFloat(rule);
  return formatPercent(value / 100, Number.isInteger(value) ? 0 : 1);
}

export default function MethodologyPage() {
  const build = getGeoBuildInfo();
  const ortsteile = getOrtsteile();
  const ringCounts = { inside: 0, partly: 0, outside: 0 };
  for (const o of ortsteile) ringCounts[o.ringStatus] += 1;

  const key = getOrtsteilBySlug(KEY_EXAMPLE);
  const area = getOrtsteilBySlug(AREA_EXAMPLE.slug);
  const keyBezirk = key && getBezirk(key.bezirkCode);
  if (!key || !keyBezirk || !area) throw new Error("Methodology examples missing from geodata");

  return (
    <>
      <div className="page-grid pt-8 pb-10 md:pt-10">
        <div className="col-span-full flex flex-col gap-3">
          <h1 className="type-title-1 stretch-wide">Methodology</h1>
          <p className="type-prose text-ink-2">
            Where each figure on this site comes from, how the geographic facts are computed, and what isn&rsquo;t built
            yet.
          </p>
        </div>
      </div>
      <div className="page-grid gap-y-12 pb-16">
        <MethodologyContents className="col-span-full lg:col-span-3" />
        <div className="col-span-full min-w-0 lg:col-span-9 lg:col-start-4">
          <MethodologyArticle
            facts={{
              provenance: GEO_PROVENANCE,
              retrieved: build.retrieved,
              bezirkCount: getBezirke().length,
              ortsteilCount: ortsteile.length,
              ringCounts,
              keyExample: { name: key.name, code: key.code, bezirkName: keyBezirk.name, bezirkCode: keyBezirk.code },
              areaExample: { name: area.name, areaKm2: area.areaKm2, ownFieldM2: AREA_EXAMPLE.ownFieldM2 },
              simplify: { plate: percentText(build.rules.plateSimplify), map: percentText(build.rules.mapSimplify) },
              registry: getDatasetRegistry(),
              census: ZENSUS_RENT_META,
            }}
          />
        </div>
      </div>
    </>
  );
}
