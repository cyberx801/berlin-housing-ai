"use client";

import { useMemo, type ReactNode } from "react";
import { Controller, useFormState, useWatch, type UseFormReturn } from "react-hook-form";
import { FloorIndicator } from "@/components/property/FloorIndicator";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { Field, inputClasses } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import {
  BUILDING_ERAS,
  CONDITIONS,
  ENERGY_CLASSES,
  FURNISHINGS,
  LIMITS,
  PROPERTY_TYPES,
  TRI_STATES,
  UNKNOWN,
} from "@/lib/property/enums";
import {
  BUILDING_ERA_LABELS,
  CONDITION_LABELS,
  ENERGY_CLASS_LABELS,
  FURNISHING_LABELS,
  PROPERTY_TYPE_LABELS,
  TRI_STATE_LABELS,
} from "@/lib/property/labels";
import {
  EMPTY_PROPERTY_FORM,
  parseDecimal,
  type FieldGroup,
  type PropertyFormValues,
  type PropertyInput,
} from "@/lib/validation/property";
import type { BezirkOption, OrtsteilOption } from "@/types/geo";
import { FIELD_LABELS, RADIO_FIELDS, type FormField } from "./fields";

const options = <V extends string>(values: readonly V[], labels: Record<V, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

const TYPE_OPTIONS = options(PROPERTY_TYPES, PROPERTY_TYPE_LABELS);
const ERA_OPTIONS = options([UNKNOWN, ...BUILDING_ERAS], BUILDING_ERA_LABELS);
const ENERGY_OPTIONS = options([UNKNOWN, ...ENERGY_CLASSES], ENERGY_CLASS_LABELS);
const CONDITION_OPTIONS = options([...CONDITIONS, UNKNOWN], CONDITION_LABELS);
const TRI_OPTIONS = options(TRI_STATES, TRI_STATE_LABELS);
const FURNISHING_OPTIONS = options([...FURNISHINGS, UNKNOWN], FURNISHING_LABELS);

/** A whole number inside the limits, or null; the floor indicator only draws valid input. */
function wholeNumber(raw: string, { min, max }: { min: number; max: number }) {
  const n = parseDecimal(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/** Moves focus to a field and scrolls its label (or legend) into view, clear of sticky bars. */
export function focusPropertyField(field: FormField, idOf: (field: FormField) => string) {
  const el = document.getElementById(idOf(field));
  if (!el) return;
  const isGroup = RADIO_FIELDS.has(field);
  const target = isGroup
    ? (el.querySelector<HTMLInputElement>("input:checked") ?? el.querySelector<HTMLInputElement>("input"))
    : el;
  const anchor = isGroup ? el : (document.querySelector(`label[for="${el.id}"]`) ?? el);
  anchor.scrollIntoView({ block: "start" });
  target?.focus({ preventScroll: true });
}

type PropertyForm = UseFormReturn<PropertyFormValues, unknown, PropertyInput>;

interface PropertyFieldsProps {
  form: Pick<PropertyForm, "control" | "register" | "setValue" | "getValues">;
  /** Element id per field. Pages and dialogs use their own prefix, so two forms never share ids. */
  idOf: (field: FormField) => string;
  bezirke: readonly BezirkOption[];
  ortsteile: readonly OrtsteilOption[];
  announce: (message: string) => void;
  /** Wraps each field group (`/analyze` adds its progress count; the compare dialog a plain heading). */
  renderSection: (group: FieldGroup, children: ReactNode) => ReactNode;
}

/**
 * The property description's fields, shared by `/analyze` and the `/compare` dialog: the same
 * labels, hints, options and Bezirk ↔ Ortsteil behaviour (PRD B3) against the same schema.
 */
export function PropertyFields({ form, idOf, bezirke, ortsteile, announce, renderSection }: PropertyFieldsProps) {
  const { control, register, setValue, getValues } = form;
  const { errors, isSubmitted } = useFormState({ control });
  const values: PropertyFormValues = { ...EMPTY_PROPERTY_FORM, ...useWatch({ control }) };
  const bezirkByCode = useMemo(() => new Map(bezirke.map((b) => [b.code, b])), [bezirke]);
  const ortsteilByCode = useMemo(() => new Map(ortsteile.map((o) => [o.code, o])), [ortsteile]);

  function onBezirkChange(code: string) {
    const current = getValues("ortsteil");
    const ortsteil = current ? ortsteilByCode.get(current) : undefined;
    if (ortsteil && code && ortsteil.bezirkCode !== code) {
      setValue("ortsteil", "", { shouldDirty: true, shouldValidate: isSubmitted });
      announce(`Ortsteil cleared: ${ortsteil.name} is not in ${bezirkByCode.get(code)?.name ?? "this Bezirk"}.`);
    }
  }

  function onOrtsteilChange(code: string) {
    const ortsteil = ortsteilByCode.get(code);
    if (ortsteil && getValues("bezirk") !== ortsteil.bezirkCode) {
      setValue("bezirk", ortsteil.bezirkCode, {
        shouldDirty: true,
        shouldValidate: isSubmitted || Boolean(errors.bezirk),
      });
      announce(`Bezirk set to ${bezirkByCode.get(ortsteil.bezirkCode)?.name ?? ortsteil.bezirkCode}.`);
    }
  }

  const selectedBezirk = values.bezirk ? bezirkByCode.get(values.bezirk) : undefined;
  const ortsteilChoices = selectedBezirk ? ortsteile.filter((o) => o.bezirkCode === selectedBezirk.code) : [];

  return (
    <>
      {renderSection(
        "location",
        <>
          <Controller
            name="bezirk"
            control={control}
            rules={{ deps: ["ortsteil"] }}
            render={({ field }) => (
              <Field id={idOf("bezirk")} label={FIELD_LABELS.bezirk} required error={errors.bezirk?.message}>
                {(c) => (
                  <Select
                    {...c}
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      field.onChange(event.target.value);
                      onBezirkChange(event.target.value);
                    }}
                  >
                    <option value="">Choose a Bezirk</option>
                    {bezirke.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
          />
          <Controller
            name="ortsteil"
            control={control}
            render={({ field }) => (
              <Field
                id={idOf("ortsteil")}
                label={FIELD_LABELS.ortsteil}
                hint={
                  selectedBezirk
                    ? `${ortsteilChoices.length} Ortsteile in ${selectedBezirk.name}.`
                    : "Choosing one also fills in its Bezirk."
                }
                error={errors.ortsteil?.message}
              >
                {(c) => (
                  <Select
                    {...c}
                    name={field.name}
                    ref={field.ref}
                    value={field.value}
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      field.onChange(event.target.value);
                      onOrtsteilChange(event.target.value);
                    }}
                  >
                    <option value="">Choose an Ortsteil</option>
                    {selectedBezirk
                      ? ortsteilChoices.map((o) => (
                          <option key={o.code} value={o.code}>
                            {o.name}
                          </option>
                        ))
                      : bezirke.map((b) => (
                          <optgroup key={b.code} label={b.name}>
                            {ortsteile
                              .filter((o) => o.bezirkCode === b.code)
                              .map((o) => (
                                <option key={o.code} value={o.code}>
                                  {o.name}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                  </Select>
                )}
              </Field>
            )}
          />
          <Field
            id={idOf("address")}
            label={FIELD_LABELS.address}
            hint="For your own reference. It isn't sent to the model or looked up on a map."
            error={errors.address?.message}
          >
            {(c) => <input type="text" autoComplete="off" className={inputClasses} {...c} {...register("address")} />}
          </Field>
        </>,
      )}

      {renderSection(
        "flat",
        <>
          {/* Controlled: an uncontrolled radio group with nothing checked reports null on blur,
              which would also corrupt the session draft. */}
          <Controller
            name="propertyType"
            control={control}
            render={({ field }) => (
              <ChoiceGroup
                id={idOf("propertyType")}
                name={field.name}
                legend={FIELD_LABELS.propertyType}
                options={TYPE_OPTIONS}
                required
                error={errors.propertyType?.message}
                value={field.value}
                onValueChange={field.onChange}
                inputProps={{ onBlur: field.onBlur }}
              />
            )}
          />
          <div className="grid gap-5 md:grid-cols-2">
            <Field
              id={idOf("area")}
              label={FIELD_LABELS.area}
              required
              unit="m²"
              hint={`Square metres, between ${LIMITS.areaM2.min} and ${LIMITS.areaM2.max}`}
              error={errors.area?.message}
            >
              {(c) => (
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className={inputClasses}
                  {...c}
                  {...register("area")}
                />
              )}
            </Field>
            <Field
              id={idOf("rooms")}
              label={FIELD_LABELS.rooms}
              required
              hint="Half rooms are fine, e.g. 2.5"
              error={errors.rooms?.message}
            >
              {(c) => (
                <input
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className={inputClasses}
                  {...c}
                  {...register("rooms")}
                />
              )}
            </Field>
          </div>
          <div className="flex items-start gap-5">
            <div className="grid min-w-0 flex-1 gap-5 md:grid-cols-2">
              <Field
                id={idOf("floor")}
                label={FIELD_LABELS.floor}
                hint="Ground floor is 0, souterrain −1"
                error={errors.floor?.message}
              >
                {(c) => (
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className={inputClasses}
                    {...c}
                    {...register("floor")}
                  />
                )}
              </Field>
              <Field
                id={idOf("totalFloors")}
                label={FIELD_LABELS.totalFloors}
                hint="The number of the top floor"
                error={errors.totalFloors?.message}
              >
                {(c) => (
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className={inputClasses}
                    {...c}
                    {...register("totalFloors", { deps: ["floor"] })}
                  />
                )}
              </Field>
            </div>
            <div className="pt-8 empty:hidden">
              <FloorIndicator
                floor={wholeNumber(values.floor, LIMITS.floor)}
                totalFloors={wholeNumber(values.totalFloors, LIMITS.totalFloors)}
              />
            </div>
          </div>
        </>,
      )}

      {renderSection(
        "building",
        <>
          <div className="grid gap-5 md:grid-cols-2">
            <Field id={idOf("buildingEra")} label={FIELD_LABELS.buildingEra} error={errors.buildingEra?.message}>
              {(c) => (
                <Select {...c} {...register("buildingEra")}>
                  {ERA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              id={idOf("energyClass")}
              label={FIELD_LABELS.energyClass}
              hint="From the Energieausweis (energy certificate)"
              error={errors.energyClass?.message}
            >
              {(c) => (
                <Select {...c} {...register("energyClass")}>
                  {ENERGY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <ChoiceGroup
            id={idOf("condition")}
            name="condition"
            legend={FIELD_LABELS.condition}
            options={CONDITION_OPTIONS}
            error={errors.condition?.message}
            inputProps={register("condition")}
          />
          <ChoiceGroup
            id={idOf("lift")}
            name="lift"
            legend={FIELD_LABELS.lift}
            options={TRI_OPTIONS}
            error={errors.lift?.message}
            inputProps={register("lift")}
          />
        </>,
      )}

      {renderSection(
        "features",
        <>
          <ChoiceGroup
            id={idOf("balcony")}
            name="balcony"
            legend={FIELD_LABELS.balcony}
            options={TRI_OPTIONS}
            error={errors.balcony?.message}
            inputProps={register("balcony")}
          />
          <ChoiceGroup
            id={idOf("furnishing")}
            name="furnishing"
            legend={FIELD_LABELS.furnishing}
            options={FURNISHING_OPTIONS}
            error={errors.furnishing?.message}
            inputProps={register("furnishing")}
          />
        </>,
      )}

      {renderSection(
        "surroundings",
        <>
          <Field
            id={idOf("transitMinutes")}
            label={FIELD_LABELS.transitMinutes}
            unit="min"
            hint={`Your own estimate in minutes, ${LIMITS.transitMinutes.min} to ${LIMITS.transitMinutes.max}`}
            error={errors.transitMinutes?.message}
            className="md:max-w-[50%]"
          >
            {(c) => (
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className={inputClasses}
                {...c}
                {...register("transitMinutes")}
              />
            )}
          </Field>
        </>,
      )}
    </>
  );
}
