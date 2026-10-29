import { formatAreaM2, formatEUR, formatEURPerM2, formatEURPrecise, formatNumber } from "@/lib/formatting/number";
import { UNKNOWN } from "@/lib/property/enums";
import {
  BUILDING_ERA_LABELS,
  CONDITION_LABELS,
  ENERGY_CLASS_LABELS,
  FURNISHING_LABELS,
  PROPERTY_TYPE_LABELS,
} from "@/lib/property/labels";
import { COMPARE_LIMITS } from "@/lib/validation/compare";
import { FIELD_LABELS } from "@/features/property-analysis/fields";
import type { CompareItem } from "./store";

export interface PlaceNames {
  bezirkName: (code: string) => string | undefined;
  ortsteilName: (code: string) => string | undefined;
}

/** The column title when the user gives none: the most specific place, then the area. */
export function defaultCompareLabel(placeName: string, areaM2: number): string {
  return `${placeName}, ${formatAreaM2(areaM2)}`.slice(0, COMPARE_LIMITS.label.max);
}

export function defaultLabelFor(property: CompareItem["property"], names: PlaceNames): string {
  const place =
    (property.ortsteilCode ? names.ortsteilName(property.ortsteilCode) : undefined) ??
    names.bezirkName(property.bezirkCode) ??
    property.bezirkCode;
  return defaultCompareLabel(place, property.areaM2);
}

/** Rents as entered: whole euros without decimals, cents when there are any. */
export function formatRent(rent: number): string {
  return Number.isInteger(rent) ? formatEUR(rent) : formatEURPrecise(rent);
}

/** Asking cold rent ÷ living area, both from the user's entries. Null without a rent. */
export function rentPerM2(item: CompareItem): number | null {
  return item.askingColdRent === null ? null : item.askingColdRent / item.property.areaM2;
}

export function formatRentPerM2(item: CompareItem): string | null {
  const value = rentPerM2(item);
  return value === null ? null : formatEURPerM2(value);
}

/** "immobilienscout24.de" for a listing link; the full address stays in the link itself. */
export function listingHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

const yesNo = (v: boolean | null) => (v === null ? null : v ? "Yes" : "No");

/** In a row already labelled "Floor": 0 is the ground floor, −1 the souterrain (as in listings). */
const floorText = (floor: number | null) =>
  floor === null ? null : floor === 0 ? "Ground floor" : floor === -1 ? "Souterrain" : String(floor);

/** Plain rows of the comparison table. Null means the value is missing (not given, or "Not sure"). */
export const ATTRIBUTE_ROWS: { key: string; label: string; value: (item: CompareItem, names: PlaceNames) => string | null }[] = [
  {
    key: "ortsteil",
    label: FIELD_LABELS.ortsteil,
    value: (i, n) => (i.property.ortsteilCode ? (n.ortsteilName(i.property.ortsteilCode) ?? null) : null),
  },
  { key: "bezirk", label: "Bezirk", value: (i, n) => n.bezirkName(i.property.bezirkCode) ?? i.property.bezirkCode },
  { key: "propertyType", label: FIELD_LABELS.propertyType, value: (i) => PROPERTY_TYPE_LABELS[i.property.propertyType] },
  { key: "area", label: FIELD_LABELS.area, value: (i) => formatAreaM2(i.property.areaM2) },
  { key: "rooms", label: FIELD_LABELS.rooms, value: (i) => formatNumber(i.property.rooms, 1) },
];

export const DETAIL_ROWS: typeof ATTRIBUTE_ROWS = [
  { key: "floor", label: FIELD_LABELS.floor, value: (i) => floorText(i.property.floor) },
  {
    key: "totalFloors",
    label: FIELD_LABELS.totalFloors,
    value: (i) => (i.property.totalFloors === null ? null : String(i.property.totalFloors)),
  },
  {
    key: "buildingEra",
    label: FIELD_LABELS.buildingEra,
    value: (i) => (i.property.buildingEra === UNKNOWN ? null : BUILDING_ERA_LABELS[i.property.buildingEra]),
  },
  {
    key: "energyClass",
    label: FIELD_LABELS.energyClass,
    value: (i) => (i.property.energyClass === UNKNOWN ? null : ENERGY_CLASS_LABELS[i.property.energyClass]),
  },
  {
    key: "condition",
    label: FIELD_LABELS.condition,
    value: (i) => (i.property.condition === UNKNOWN ? null : CONDITION_LABELS[i.property.condition]),
  },
  { key: "lift", label: FIELD_LABELS.lift, value: (i) => yesNo(i.property.hasLift) },
  { key: "balcony", label: FIELD_LABELS.balcony, value: (i) => yesNo(i.property.hasBalcony) },
  {
    key: "furnishing",
    label: FIELD_LABELS.furnishing,
    value: (i) => (i.property.furnishing === UNKNOWN ? null : FURNISHING_LABELS[i.property.furnishing]),
  },
  {
    key: "transitMinutes",
    label: FIELD_LABELS.transitMinutes,
    value: (i) => (i.property.transitMinutes === null ? null : `${i.property.transitMinutes} min`),
  },
];
