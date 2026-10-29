import type { ComponentProps, ReactNode } from "react";
import { cx } from "@/lib/cx";
import { FieldError } from "./Field";

interface Option<V extends string> {
  value: V;
  label: string;
}

interface ChoiceGroupProps<V extends string> {
  /** Unique base for element ids (routes stay mounted while hidden, so ids must be page-unique). */
  id: string;
  name: string;
  legend: ReactNode;
  options: readonly Option<V>[];
  required?: boolean;
  hint?: ReactNode;
  error?: string | undefined;
  /** Props spread onto every radio input (e.g. react-hook-form `register(name)`). */
  inputProps?: Omit<ComponentProps<"input">, "type" | "value" | "id">;
  /** Controlled usage outside forms. */
  value?: V;
  onValueChange?: (value: V) => void;
  className?: string;
  size?: "md" | "sm";
}

/**
 * A radio group styled as joined pills (segmented control). Native radios keep arrow-key
 * navigation and form semantics; the selected pill gets marker fill + ink outline.
 */
export function ChoiceGroup<V extends string>({
  id: baseId,
  name,
  legend,
  options,
  required = false,
  hint,
  error,
  inputProps,
  value,
  onValueChange,
  className,
  size = "md",
}: ChoiceGroupProps<V>) {
  const hintId = hint ? `${baseId}-hint` : undefined;
  const errorId = error ? `${baseId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset
      id={baseId}
      className={cx("flex min-w-0 flex-col gap-1.5", className)}
      aria-describedby={describedBy}
      {...(error ? { "aria-invalid": true } : {})}
    >
      <legend className="mb-1.5 flex flex-wrap items-baseline gap-x-2 type-body font-[600]">
        <span>{legend}</span>
        <span className="type-small font-[450] text-ink-3">{required ? "Required" : "Optional"}</span>
      </legend>
      {hint ? (
        <p id={hintId} className="-mt-1 type-small text-ink-2">
          {hint}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const id = `${baseId}-${option.value}`;
          const controlled =
            value !== undefined
              ? { checked: value === option.value, onChange: () => onValueChange?.(option.value) }
              : {};
          return (
            <span key={option.value} className="relative">
              <input
                type="radio"
                id={id}
                name={name}
                value={option.value}
                className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-full opacity-0"
                {...(required ? { "aria-required": true } : {})}
                {...inputProps}
                {...controlled}
              />
              <label
                htmlFor={id}
                className={cx(
                  "pointer-events-none flex items-center rounded-full border border-line-strong bg-sheet text-ink transition-state",
                  size === "md" ? "min-h-11 px-4 type-body" : "min-h-9 px-3 type-small",
                  "peer-hover:border-ink",
                  "peer-checked:border-ink peer-checked:bg-marker peer-checked:font-[620] peer-checked:shadow-[inset_0_0_0_1px_var(--color-ink)]",
                  "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
                  error && "border-critical",
                )}
              >
                {option.label}
              </label>
            </span>
          );
        })}
      </div>
      {error ? <FieldError id={errorId!}>{error}</FieldError> : null}
    </fieldset>
  );
}
