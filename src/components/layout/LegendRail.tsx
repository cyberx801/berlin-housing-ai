import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/**
 * The legend rail: what a page shows, in which units, from which source.
 * Sticky beside the plate on large screens; flows above it on smaller ones.
 */
export function LegendRail({
  label = "Legend and sources",
  children,
  className,
  sticky = true,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
  sticky?: boolean;
}) {
  return (
    <aside
      aria-label={label}
      className={cx(
        "flex min-w-0 flex-col gap-6",
        sticky && "lg:sticky lg:top-[calc(var(--header-height)+1.5rem)] lg:self-start",
        className,
      )}
    >
      {children}
    </aside>
  );
}

export function LegendBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-ink pt-3">
      <h2 className="type-small font-[650] text-ink">{title}</h2>
      <div className="type-small text-ink-2">{children}</div>
    </div>
  );
}
