import { cx } from "@/lib/cx";
import type { ProvenanceKind } from "@/types/provenance";

/** Legend swatch for a provenance kind. Decorative: always paired with words. */
export function ProvenanceMark({ kind, className }: { kind: ProvenanceKind; className?: string }) {
  return (
    <span aria-hidden="true" className={cx("inline-flex h-3 w-7 shrink-0 items-center", className)}>
      <span
        className={cx(
          "block w-full",
          // Borders, not backgrounds: they survive forced-colors mode.
          (kind === "official" || kind === "model") && "border-t-4 border-ink",
          (kind === "user" || kind === "research") && "border-t-4 border-ink-2",
          kind === "demo" && "band-hatch h-3 border border-line-strong",
          kind === "not-connected" && "h-3 border-[1.5px] border-dashed border-line-strong",
          kind === "pending" && "h-3 border border-rule bg-paper",
        )}
      />
    </span>
  );
}
