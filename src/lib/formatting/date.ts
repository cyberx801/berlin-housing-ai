const LOCALE = "en-GB";

const day = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const month = new Intl.DateTimeFormat(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * "2026-06-30" → "30 June 2026", "2026-06" → "June 2026". Timestamps use their UTC date.
 * Anything unrecognised is returned unchanged rather than guessed at.
 */
export function formatIsoDate(iso: string): string {
  const ym = /^(\d{4})-(\d{2})$/.exec(iso);
  if (ym) return month.format(Date.UTC(Number(ym[1]), Number(ym[2]) - 1, 1));
  if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(iso)) {
    const time = Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
    if (Number.isFinite(time)) return day.format(time);
  }
  return iso;
}
