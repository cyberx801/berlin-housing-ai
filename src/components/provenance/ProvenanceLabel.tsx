import Link from "next/link";
import { cx } from "@/lib/cx";
import type { Provenance } from "@/types/provenance";
import { ProvenanceMark } from "./ProvenanceMark";
import { PROVENANCE_COPY, provenanceDetail } from "./provenance-copy";

/** "Official data / Demo data / Not connected…" in words, with its methodology link. */
export function ProvenanceLabel({
  provenance,
  showDetail = true,
  className,
}: {
  provenance: Provenance;
  showDetail?: boolean;
  className?: string;
}) {
  const copy = PROVENANCE_COPY[provenance.kind];
  const detail = showDetail ? provenanceDetail(provenance) : null;
  return (
    <p className={cx("flex flex-wrap items-center gap-x-3 gap-y-1 type-small text-ink-2", className)}>
      <span className="inline-flex items-center gap-2 font-[620] text-ink">
        <ProvenanceMark kind={provenance.kind} className="shrink-0" />
        {copy.label}
      </span>
      {provenance.kind === "official" && showDetail ? (
        // The licence id must not break at its hyphens on narrow screens.
        <span>
          {provenance.label}, <span className="whitespace-nowrap">{provenance.license}</span>
        </span>
      ) : detail ? (
        <span>{detail}</span>
      ) : null}
      <Link href={copy.href} className="underline decoration-line-strong underline-offset-4 hover:decoration-ink">
        How we label data
      </Link>
    </p>
  );
}
