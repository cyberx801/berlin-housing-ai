import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cx } from "@/lib/cx";
import { inputClasses } from "./Field";

/** Native select (best on mobile and for assistive tech) with the Atlas field styling. */
export function Select({ className, children, ...rest }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cx(inputClasses, "appearance-none pr-10", className)} {...rest}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-ink-2"
      />
    </div>
  );
}
