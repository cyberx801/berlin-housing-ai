import { CircleAlert, Info, Unplug } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

type Tone = "not-connected" | "error" | "empty" | "info";

const ICONS = { "not-connected": Unplug, error: CircleAlert, empty: Info, info: Info } as const;

interface StatusPanelProps {
  tone: Tone;
  title: string;
  titleAs?: "h2" | "h3";
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  id?: string;
  /** Moves focus here when it appears (e.g. after a form submit). */
  focusTarget?: boolean;
}

/** Not-connected, error, empty and info states: what happened, what it means, what to do next. */
export function StatusPanel({
  tone,
  title,
  titleAs: Title = "h2",
  children,
  actions,
  className,
  id,
  focusTarget,
}: StatusPanelProps) {
  const Icon = ICONS[tone];
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-title` : undefined}
      tabIndex={focusTarget ? -1 : undefined}
      className={cx(
        "flex flex-col gap-3 bg-sheet p-5 md:p-6",
        tone === "not-connected" && "frame-not-connected",
        tone === "error" && "border-l-4 border-critical",
        (tone === "empty" || tone === "info") && "border border-rule",
        className,
      )}
    >
      <Title id={id ? `${id}-title` : undefined} className="flex items-start gap-2.5 type-title-3">
        <Icon
          aria-hidden="true"
          className={cx("mt-1 size-5 shrink-0", tone === "error" ? "text-critical" : "text-ink-2")}
        />
        <span>{title}</span>
      </Title>
      {children ? <div className="flex max-w-[68ch] flex-col gap-2 text-ink-2">{children}</div> : null}
      {actions ? <div className="mt-1 flex flex-wrap gap-3">{actions}</div> : null}
    </section>
  );
}
