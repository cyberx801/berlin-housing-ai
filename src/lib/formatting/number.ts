import { RING_INSIDE_MIN, RING_OUTSIDE_MAX } from "@/lib/geo/ring";

// One locale everywhere: en-GB gives consistent English conventions (€1,150 · 17.69 · 7.7 km²).
// en-DE mixes decimal commas with comma-grouped currency (DECISIONS D-023).
const LOCALE = "en-GB";
const NNBSP = " "; // narrow no-break space between value and unit

const eur0 = new Intl.NumberFormat(LOCALE, { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const eur2 = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const n0 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const n1 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const n2 = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });
const n2fixed = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatEUR(value: number): string {
  return eur0.format(value);
}

export function formatEURPrecise(value: number): string {
  return eur2.format(value);
}

export function formatEURPerM2(value: number): string {
  return `${eur2.format(value)}${NNBSP}/m²`;
}

export function formatAreaM2(value: number): string {
  return `${n1.format(value)}${NNBSP}m²`;
}

/** `fixed`: always two decimals, so a column of areas lines up ("7.70 km²" above "10.58 km²"). */
export function formatKm2(value: number, fixed = false): string {
  return `${(fixed ? n2fixed : n2).format(value)}${NNBSP}km²`;
}

export function formatPercent(share: number, fractionDigits: 0 | 1 = 0): string {
  return `${(fractionDigits === 0 ? n0 : n1).format(share * 100)}${NNBSP}%`;
}

/**
 * Share of an Ortsteil inside the ring. Whole percent, except where rounding would cross a
 * status threshold (e.g. 94.6 % shown as "95 %" next to "Partly inside").
 */
export function formatRingShare(share: number): string {
  const whole = Math.round(share * 100);
  const crosses =
    (share < RING_INSIDE_MIN && whole >= RING_INSIDE_MIN * 100) ||
    (share > RING_OUTSIDE_MAX && whole <= RING_OUTSIDE_MAX * 100);
  return `${(crosses ? n1 : n0).format(share * 100)}${NNBSP}%`;
}

export function formatNumber(value: number, fractionDigits: 0 | 1 | 2 = 0): string {
  return (fractionDigits === 0 ? n0 : fractionDigits === 1 ? n1 : n2).format(value);
}

export function formatRooms(value: number): string {
  return `${n1.format(value)} ${value === 1 ? "room" : "rooms"}`;
}

/** Floor numbers as Berlin listings use them: 0 = ground floor, −1 = souterrain. */
export function formatFloor(floor: number, totalFloors?: number | null): string {
  const label = floor === 0 ? "Ground floor" : floor === -1 ? "Souterrain" : `Floor ${floor}`;
  return totalFloors ? `${label} of ${totalFloors}` : label;
}
