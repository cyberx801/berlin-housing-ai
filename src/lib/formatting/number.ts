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

export function formatKm2(value: number): string {
  return `${n2.format(value)}${NNBSP}km²`;
}

export function formatPercent(share: number): string {
  return `${n0.format(share * 100)}${NNBSP}%`;
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
