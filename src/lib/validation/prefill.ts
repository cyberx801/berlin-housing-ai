import { PROPERTY_TYPES, type PropertyType } from "@/lib/property/enums";
import type { ParamReader } from "@/lib/url-state/params";
import type { BezirkOption, OrtsteilOption } from "@/types/geo";
import { areaField, roomsField, type PropertyFormValues } from "./property";

export type PrefillField = "bezirk" | "ortsteil" | "type" | "area" | "rooms";

export const PREFILL_LABELS: Record<PrefillField, string> = {
  bezirk: "Bezirk",
  ortsteil: "Ortsteil",
  type: "property type",
  area: "living area",
  rooms: "rooms",
};

export interface PrefillResult {
  values: Partial<PropertyFormValues>;
  /** Parameters that were present but unusable; they are left empty, never guessed. */
  ignored: PrefillField[];
}

/**
 * Reads `/analyze?bezirk=<slug>&ortsteil=<slug>&type=&area=&rooms=` (D-030).
 * Each value is checked with the same rules as the form; anything invalid is dropped and reported.
 */
export function readAnalyzePrefill(
  params: ParamReader,
  bezirke: readonly BezirkOption[],
  ortsteile: readonly OrtsteilOption[],
): PrefillResult {
  const values: Partial<PropertyFormValues> = {};
  const ignored: PrefillField[] = [];
  const raw = (name: PrefillField) => params.get(name)?.trim() ?? "";

  const bezirkSlug = raw("bezirk");
  const bezirk = bezirkSlug ? bezirke.find((b) => b.slug === bezirkSlug) : undefined;
  if (bezirkSlug && !bezirk) ignored.push("bezirk");
  if (bezirk) values.bezirk = bezirk.code;

  const ortsteilSlug = raw("ortsteil");
  if (ortsteilSlug) {
    const ortsteil = ortsteile.find((o) => o.slug === ortsteilSlug);
    if (!ortsteil || (bezirk && ortsteil.bezirkCode !== bezirk.code)) {
      ignored.push("ortsteil");
    } else {
      values.ortsteil = ortsteil.code;
      // An Ortsteil alone is enough to know its Bezirk.
      values.bezirk = ortsteil.bezirkCode;
    }
  }

  const type = raw("type");
  if (type) {
    if ((PROPERTY_TYPES as readonly string[]).includes(type)) values.propertyType = type as PropertyType;
    else ignored.push("type");
  }

  for (const [field, schema] of [
    ["area", areaField],
    ["rooms", roomsField],
  ] as const) {
    const value = raw(field);
    if (!value) continue;
    if (schema.safeParse(value).success) values[field] = value;
    else ignored.push(field);
  }

  return { values, ignored };
}
