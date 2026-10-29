import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

/** Native <details>: keyboard and screen-reader support for free. */
export function Disclosure({
  summary,
  children,
  className,
  defaultOpen = false,
}: {
  summary: ReactNode;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
}) {
  return (
    <details className={cx("group", className)} open={defaultOpen}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 type-body font-[600] text-ink [&::-webkit-details-marker]:hidden">
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 -rotate-90 transition-state group-open:rotate-0"
        />
        <span className="underline decoration-line-strong underline-offset-4 group-hover:decoration-ink">
          {summary}
        </span>
      </summary>
      <div className="pt-2 pl-7">{children}</div>
    </details>
  );
}
