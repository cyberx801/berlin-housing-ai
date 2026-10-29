import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "@/lib/cx";

export const inputClasses = cx(
  "block w-full min-h-11 rounded-control border border-line-strong bg-sheet px-3 text-ink type-body",
  "transition-state placeholder:text-ink-3 hover:border-ink",
  "focus-visible:border-ink aria-invalid:border-2 aria-invalid:border-critical",
  "disabled:border-dashed disabled:text-ink-3",
);

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
}

interface FieldProps {
  id: string;
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string | undefined;
  /** Unit shown after the control, e.g. "m²". */
  unit?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
}

/** Label, required/optional marker (in words), hint, unit and error wiring for one control. */
export function Field({ id, label, required = false, hint, error, unit, className, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  const control: FieldControlProps = {
    id,
    ...(describedBy ? { "aria-describedby": describedBy } : {}),
    ...(error ? { "aria-invalid": true as const } : {}),
    ...(required ? { "aria-required": true as const } : {}),
  };

  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="flex flex-wrap items-baseline gap-x-2 type-body font-[600]">
        <span>{label}</span>
        <span className="type-small font-[450] text-ink-3">{required ? "Required" : "Optional"}</span>
      </label>
      {hint ? (
        <p id={hintId} className="type-small text-ink-2">
          {hint}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{children(control)}</div>
        {unit ? (
          <span className="type-body text-ink-2" aria-hidden="true">
            {unit}
          </span>
        ) : null}
      </div>
      {error ? <FieldError id={errorId!}>{error}</FieldError> : null}
    </div>
  );
}

export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 type-small font-[560] text-critical">
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
