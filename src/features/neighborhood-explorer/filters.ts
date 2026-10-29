// Place filters and their URL form. Pure, so `/explore` and `/neighborhoods` share them
// (both read `bezirk`, `ring` and `q`; `/explore` adds the selection `o`). Places are named by
// slug in URLs (D-030) and by official code everywhere else.
import { buildQuery, readEnum, readString, type ParamReader } from "@/lib/url-state/params";
import type { RingStatus } from "@/types/geo";

export const RING_FILTERS = ["inside", "partly", "outside"] as const satisfies readonly RingStatus[];
export const QUERY_MAX_LENGTH = 60;

export interface PlaceFilter {
  /** Bezirk code, or null for all. */
  bezirk: string | null;
  ring: RingStatus | null;
  q: string;
}

export const NO_FILTER: PlaceFilter = { bezirk: null, ring: null, q: "" };

export interface FilterablePlace {
  code: string;
  name: string;
  slug: string;
  bezirkCode: string;
  ringStatus: RingStatus;
}

export interface PlaceLookups {
  ortsteilCodeBySlug: ReadonlyMap<string, string>;
  ortsteilSlugByCode: ReadonlyMap<string, string>;
  bezirkCodeBySlug: ReadonlyMap<string, string>;
  bezirkSlugByCode: ReadonlyMap<string, string>;
}

export function createLookups(
  places: readonly { code: string; slug: string }[],
  bezirke: readonly { code: string; slug: string }[],
): PlaceLookups {
  return {
    ortsteilCodeBySlug: new Map(places.map((p) => [p.slug, p.code])),
    ortsteilSlugByCode: new Map(places.map((p) => [p.code, p.slug])),
    bezirkCodeBySlug: new Map(bezirke.map((b) => [b.slug, b.code])),
    bezirkSlugByCode: new Map(bezirke.map((b) => [b.code, b.slug])),
  };
}

const UMLAUT_DIGRAPHS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue" };

function baseFold(text: string): string {
  return text
    .toLocaleLowerCase("de")
    .replace(/ß/g, "ss")
    .replace(/[-‐–]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lowercase, hyphens as spaces, ß as ss, accents dropped: "Neukölln" → "neukolln". */
export function foldQuery(text: string): string {
  return baseFold(text).normalize("NFD").replace(/\p{M}/gu, "");
}

/**
 * Every spelling a name can be searched by: accents dropped ("neukolln") and the German
 * transliteration ("neukoelln"), so English keyboards find the place either way.
 */
export function searchKeys(name: string): string[] {
  const folded = baseFold(name);
  const transliterated = folded.replace(/[äöü]/g, (c) => UMLAUT_DIGRAPHS[c] ?? c);
  return [...new Set([foldQuery(folded), transliterated])];
}

export function isFiltered(filter: PlaceFilter): boolean {
  return filter.bezirk !== null || filter.ring !== null || foldQuery(filter.q) !== "";
}

/** Returns a predicate; the folded query and each place's keys are computed once. */
export function placeMatcher(filter: PlaceFilter): (place: FilterablePlace) => boolean {
  const query = foldQuery(filter.q);
  return (place) =>
    (filter.bezirk === null || place.bezirkCode === filter.bezirk) &&
    (filter.ring === null || place.ringStatus === filter.ring) &&
    (query === "" || searchKeys(place.name).some((key) => key.includes(query)));
}

export interface ExploreUrlState extends PlaceFilter {
  /** Selected Ortsteil code. */
  selected: string | null;
}

export type ExploreUrlIssue = "o" | "bezirk" | "ring";

export const EMPTY_EXPLORE_STATE: ExploreUrlState = { ...NO_FILTER, selected: null };

/** Reads `bezirk`, `ring` and `q`. Unknown values fall back to "all" and are reported. */
export function readPlaceFilter(
  params: ParamReader,
  lookups: PlaceLookups,
): { filter: PlaceFilter; invalid: ("bezirk" | "ring")[] } {
  const invalid: ("bezirk" | "ring")[] = [];
  const bezirkSlug = params.get("bezirk");
  const bezirk = bezirkSlug ? (lookups.bezirkCodeBySlug.get(bezirkSlug) ?? null) : null;
  if (bezirkSlug && bezirk === null) invalid.push("bezirk");
  const ring = readEnum(params, "ring", [...RING_FILTERS, ""] as const, "");
  if (ring.invalid) invalid.push("ring");
  const q = readString(params, "q", QUERY_MAX_LENGTH);
  return { filter: { bezirk, ring: ring.value === "" ? null : ring.value, q }, invalid };
}

export function readExploreParams(
  params: ParamReader,
  lookups: PlaceLookups,
): { state: ExploreUrlState; invalid: ExploreUrlIssue[] } {
  const { filter, invalid } = readPlaceFilter(params, lookups);
  const slug = params.get("o");
  const selected = slug ? (lookups.ortsteilCodeBySlug.get(slug) ?? null) : null;
  return {
    state: { ...filter, selected },
    invalid: slug && selected === null ? ["o", ...invalid] : invalid,
  };
}

/** "?o=moabit&bezirk=mitte&ring=inside&q=…", or "" when nothing is set. */
export function exploreQuery(state: ExploreUrlState, lookups: PlaceLookups): string {
  return buildQuery({
    o: state.selected ? lookups.ortsteilSlugByCode.get(state.selected) : null,
    bezirk: state.bezirk ? lookups.bezirkSlugByCode.get(state.bezirk) : null,
    ring: state.ring,
    q: state.q.trim(),
  });
}
