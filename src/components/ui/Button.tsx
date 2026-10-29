import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";

type Variant = "primary" | "secondary" | "quiet";
type Size = "md" | "sm";

export function buttonClasses({ variant = "primary", size = "md" }: { variant?: Variant; size?: Size } = {}) {
  return cx(
    "inline-flex items-center justify-center gap-2 font-sans font-[620] transition-state",
    "select-none disabled:cursor-not-allowed aria-disabled:cursor-not-allowed",
    variant !== "quiet" && "rounded-control",
    variant !== "quiet" && (size === "md" ? "min-h-11 px-5 type-body" : "min-h-9 px-3.5 type-small"),
    variant === "primary" &&
      "bg-ink text-on-ink hover:bg-ink-hover active:translate-y-px aria-disabled:bg-ink-3",
    variant === "secondary" &&
      "border border-ink bg-transparent text-ink hover:bg-sheet hover:shadow-[inset_0_0_0_1px_var(--color-ink)] active:translate-y-px",
    variant === "quiet" &&
      "min-h-6 text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink hover:decoration-2",
  );
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size; icon?: ReactNode };

export function Button({ variant, size, icon, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={cx(buttonClasses({ variant, size }), className)} {...rest}>
      {icon ? <span aria-hidden="true" className="shrink-0 [&>svg]:size-[1.15em]">{icon}</span> : null}
      {children}
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode };

export function ButtonLink({ variant, size, icon, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cx(buttonClasses({ variant, size }), "no-underline", className)} {...rest}>
      {icon ? <span aria-hidden="true" className="shrink-0 [&>svg]:size-[1.15em]">{icon}</span> : null}
      {children}
    </Link>
  );
}
