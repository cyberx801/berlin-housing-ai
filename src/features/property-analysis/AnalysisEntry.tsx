"use client";

import Form from "next/form";
import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, inputClasses } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { createAnalysisEntrySchema } from "@/lib/validation/property";
import type { BezirkOption } from "@/types/geo";

type EntryField = "bezirk" | "area" | "rooms";
type EntryErrors = Partial<Record<EntryField, string>>;
const FIELD_ORDER: EntryField[] = ["bezirk", "area", "rooms"];

/**
 * Bezirk, living area and rooms, sent to `/analyze` as URL parameters (PRD A3).
 * A plain GET form: it works before hydration, and `/analyze` validates the values again.
 */
export function AnalysisEntry({ bezirke, idPrefix }: { bezirke: readonly BezirkOption[]; idPrefix: string }) {
  const schema = useMemo(() => createAnalysisEntrySchema(bezirke), [bezirke]);
  const [errors, setErrors] = useState<EntryErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const id = (field: EntryField) => `${idPrefix}-${field}`;

  function validate(form: HTMLFormElement): EntryErrors {
    const data = new FormData(form);
    const result = schema.safeParse({
      bezirk: String(data.get("bezirk") ?? ""),
      area: String(data.get("area") ?? ""),
      rooms: String(data.get("rooms") ?? ""),
    });
    const next: EntryErrors = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as EntryField;
        next[field] ??= issue.message;
      }
    }
    return next;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    const next = validate(event.currentTarget);
    setErrors(next);
    setSubmitted(true);
    const firstInvalid = FIELD_ORDER.find((f) => next[f]);
    if (firstInvalid) {
      event.preventDefault();
      document.getElementById(id(firstInvalid))?.focus();
    }
  }

  return (
    <section aria-labelledby={`${idPrefix}-title`} className="flex flex-col gap-4 border-t-[3px] border-ink-2 bg-sheet p-4 md:p-5">
      <div className="flex flex-col gap-1">
        <h2 id={`${idPrefix}-title`} className="type-title-3 stretch-wide">
          Start an analysis
        </h2>
        <p className="type-small text-ink-2">Three details are enough to begin. You add the rest on the next page.</p>
      </div>
      <Form
        action="/analyze"
        noValidate
        onSubmit={onSubmit}
        onChange={(e) => {
          if (submitted) setErrors(validate(e.currentTarget));
        }}
        className="grid grid-cols-2 gap-x-4 gap-y-4"
      >
        <Field id={id("bezirk")} label="Bezirk (borough)" required error={errors.bezirk} className="col-span-2">
          {(control) => (
            <Select name="bezirk" defaultValue="" {...control}>
              <option value="">Choose a Bezirk</option>
              {bezirke.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          id={id("area")}
          label="Living area"
          required
          hint="Between 10 and 500"
          unit="m²"
          error={errors.area}
          className="col-span-2 md:col-span-1"
        >
          {(control) => (
            <input
              name="area"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className={inputClasses}
              {...control}
            />
          )}
        </Field>
        <Field
          id={id("rooms")}
          label="Rooms"
          required
          hint="Half rooms are fine, e.g. 2.5"
          error={errors.rooms}
          className="col-span-2 md:col-span-1"
        >
          {(control) => (
            <input
              name="rooms"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className={inputClasses}
              {...control}
            />
          )}
        </Field>
        <div className="col-span-2">
          <Button type="submit">Continue to the full form</Button>
        </div>
      </Form>
    </section>
  );
}
