import { formatAreaM2, formatFloor, formatNumber } from "@/lib/formatting/number";
import {
  BUILDING_ERA_LABELS,
  CONDITION_LABELS,
  ENERGY_CLASS_LABELS,
  FURNISHING_LABELS,
  PROPERTY_TYPE_LABELS,
} from "@/lib/property/labels";
import { UNKNOWN } from "@/lib/property/enums";
import type { PropertyInput } from "@/lib/validation/property";
import { FIELD_LABELS } from "./fields";

export interface ResultPlace {
  bezirkName: string;
  bezirkSlug: string;
  ortsteilName: string | null;
  ortsteilSlug: string | null;
}

const yesNo = (v: boolean | null) => (v === null ? null : v ? "Yes" : "No");

/** What the user entered, as a definition list. "Not sure" answers are listed once at the end. */
export function InputSummary({ input, place }: { input: PropertyInput; place: ResultPlace }) {
  const rows: [string, string | null][] = [
    ["Location", place.ortsteilName ? `${place.ortsteilName}, ${place.bezirkName}` : place.bezirkName],
    [FIELD_LABELS.propertyType, PROPERTY_TYPE_LABELS[input.propertyType]],
    [FIELD_LABELS.area, formatAreaM2(input.areaM2)],
    [FIELD_LABELS.rooms, formatNumber(input.rooms, 1)],
    [
      FIELD_LABELS.floor,
      input.floor !== null
        ? formatFloor(input.floor, input.totalFloors)
        : input.totalFloors !== null
          ? `Top floor is ${input.totalFloors}`
          : null,
    ],
    [FIELD_LABELS.buildingEra, input.buildingEra === UNKNOWN ? null : BUILDING_ERA_LABELS[input.buildingEra]],
    [FIELD_LABELS.energyClass, input.energyClass === UNKNOWN ? null : ENERGY_CLASS_LABELS[input.energyClass]],
    [FIELD_LABELS.condition, input.condition === UNKNOWN ? null : CONDITION_LABELS[input.condition]],
    [FIELD_LABELS.lift, yesNo(input.hasLift)],
    [FIELD_LABELS.balcony, yesNo(input.hasBalcony)],
    [FIELD_LABELS.furnishing, input.furnishing === UNKNOWN ? null : FURNISHING_LABELS[input.furnishing]],
    [FIELD_LABELS.transitMinutes, input.transitMinutes === null ? null : `${input.transitMinutes} min`],
  ];
  const given = rows.filter((row): row is [string, string] => row[1] !== null);
  const open = rows.filter(([, value]) => value === null).map(([label]) => label);
  if (!place.ortsteilName) open.unshift(FIELD_LABELS.ortsteil);

  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-6 gap-y-1.5 type-small md:max-w-[36rem]">
        {given.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-ink-2">{label}</dt>
            <dd className="font-[560] text-ink">{value}</dd>
          </div>
        ))}
        {input.address ? (
          <div className="contents">
            <dt className="text-ink-2">Your note</dt>
            <dd className="text-ink">
              {input.address} <span className="text-ink-2">(kept in this browser, not sent)</span>
            </dd>
          </div>
        ) : null}
      </dl>
      {open.length > 0 ? (
        <p className="type-small text-ink-2">Not sure or not given: {open.join(", ")}.</p>
      ) : null}
    </div>
  );
}
