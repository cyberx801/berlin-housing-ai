import Link from "next/link";
import { ProvenanceMark } from "@/components/provenance/ProvenanceMark";
import { PROVENANCE_COPY } from "@/components/provenance/provenance-copy";
import type { ProvenanceKind } from "@/types/provenance";

interface TruthRow {
  kind: ProvenanceKind;
  label: string;
  covers: string;
  limits: string;
}

// PRD §3 capability truth table, in plain language (PRD A6).
const ROWS: TruthRow[] = [
  {
    kind: "official",
    label: "Official data",
    covers:
      "Bezirk and Ortsteil boundaries, their areas, which Ortsteile border each other, and how much of each lies inside the S-Bahn ring.",
    limits: "Geography only. It says nothing about rents, prices or what a place is like to live in.",
  },
  {
    kind: "user",
    label: "From your entries",
    covers: "Listings you add to Compare and flats you describe in Analyze, including the €/m² worked out from them.",
    limits: "Stored only in this browser. Nothing is sent to a server.",
  },
  {
    kind: "demo",
    label: "Demo data",
    covers: "The market charts: rent trends, €/m² by district, price spreads and property types.",
    limits: "Generated so the charts can be built and reviewed. They are not Berlin market statistics.",
  },
  {
    kind: "not-connected",
    label: "Not connected",
    covers: "Rent estimates, and transit access for each Ortsteil.",
    limits: "The rent model is still being built. Until it is connected, no estimate or fair-price figure appears anywhere.",
  },
  {
    kind: "pending",
    label: "Not written yet",
    covers: "Descriptions of what each neighborhood is like.",
    limits: "Profiles show computed facts only. Nothing is invented to fill the space.",
  },
];

export function DataTruthLedger() {
  return (
    <dl className="border-t border-ink">
      {ROWS.map((row) => (
        <div
          key={row.kind}
          className="grid grid-cols-1 gap-x-6 gap-y-2 border-b border-rule py-4 md:grid-cols-[14rem_minmax(0,1fr)]"
        >
          <dt className="flex items-center gap-2 type-body font-[640]">
            <ProvenanceMark kind={row.kind} />
            {row.label}
          </dt>
          <dd className="flex max-w-[68ch] flex-col gap-1">
            <p className="type-body">{row.covers}</p>
            <p className="type-small text-ink-2">
              {row.limits}{" "}
              <Link href={PROVENANCE_COPY[row.kind].href} className="text-ink-2">
                How this is labeled
              </Link>
            </p>
          </dd>
        </div>
      ))}
    </dl>
  );
}
