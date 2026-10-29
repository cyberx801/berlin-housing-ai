import type { ReactNode } from "react";
import { cx } from "@/lib/cx";
import type { Provenance } from "@/types/provenance";
import { ProvenanceLabel } from "./ProvenanceLabel";

interface PlateProps {
  /** The question this module answers, phrased for the reader. */
  title: ReactNode;
  titleAs?: "h2" | "h3";
  provenance: Provenance;
  children: ReactNode;
  /** Source or method note under the figure. */
  caption?: ReactNode;
  actions?: ReactNode;
  id?: string;
  className?: string;
  bodyClassName?: string;
}

/**
 * A figure "plate": legend band (provenance notation) → title → body → caption.
 * Provenance is required by type; nothing data-bearing renders without it.
 */
export function Plate({
  title,
  titleAs: Title = "h2",
  provenance,
  children,
  caption,
  actions,
  id,
  className,
  bodyClassName,
}: PlateProps) {
  const kind = provenance.kind;
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      className={cx(
        "relative flex min-w-0 flex-col bg-sheet",
        (kind === "official" || kind === "model") && "border-t-[3px] border-ink",
        (kind === "user" || kind === "research") && "border-t-[3px] border-ink-2",
        kind === "not-connected" && "frame-not-connected",
        kind === "pending" && "border border-rule bg-paper",
        className,
      )}
    >
      {kind === "demo" ? <div aria-hidden="true" className="band-hatch h-3 border-b border-line-strong" /> : null}
      <header className="flex flex-col gap-2 px-4 pt-4 md:px-5">
        <ProvenanceLabel provenance={provenance} />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Title id={id ? `${id}-title` : undefined} className="type-title-2 stretch-wide max-w-[40ch]">
            {title}
          </Title>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </header>
      <div className={cx("min-w-0 px-4 py-4 md:px-5", bodyClassName)}>{children}</div>
      {caption ? (
        <footer className="border-t border-rule px-4 py-3 type-small text-ink-2 md:px-5">{caption}</footer>
      ) : null}
    </section>
  );
}
