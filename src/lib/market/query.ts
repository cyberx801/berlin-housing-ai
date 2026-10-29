// Market filters: the page URL form (`bezirke`, `from`, `to`, `type`, with Bezirk slugs) and the
// API form (Bezirk codes) used between the dashboard and /api/market/*. Pure and client-safe.
import { buildQuery, readEnum, type ParamReader } from "@/lib/url-state/params";
import {
  MARKET_TYPES,
  type BezirkCode,
  type MarketCoverage,
  type MarketPeriod,
  type MarketTypeFilter,
} from "@/types/market";

/** Trend lines follow the adjacent-pair palette rule, so at most 4 Bezirke (D-021). */
export const MAX_BEZIRKE = 4;
export const TYPE_FILTERS = ["all", ...MARKET_TYPES] as const satisfies readonly MarketTypeFilter[];

const BEZIRK_CODE = /^(0[1-9]|1[0-2])$/;
const YEAR = /^\d{4}$/;

export interface MarketFilter extends MarketPeriod {
  /** Bezirk codes in the order they were chosen; the order decides the series colors. */
  bezirke: BezirkCode[];
  type: MarketTypeFilter;
}

export function defaultFilter(coverage: MarketCoverage): MarketFilter {
  return { bezirke: [], from: coverage.firstYear, to: coverage.lastYear, type: "all" };
}

export function sameFilter(a: MarketFilter, b: MarketFilter): boolean {
  return (
    a.from === b.from &&
    a.to === b.to &&
    a.type === b.type &&
    a.bezirke.length === b.bezirke.length &&
    a.bezirke.every((code, i) => b.bezirke[i] === code)
  );
}

export function years(coverage: MarketCoverage): number[] {
  return Array.from({ length: coverage.lastYear - coverage.firstYear + 1 }, (_, i) => coverage.firstYear + i);
}

// ---------- Page URL ----------

export type MarketUrlIssue = "bezirke" | "too-many" | "period" | "type";

export interface BezirkSlugs {
  codeBySlug: ReadonlyMap<string, string>;
  slugByCode: ReadonlyMap<string, string>;
}

export function createBezirkSlugs(bezirke: readonly { code: string; slug: string }[]): BezirkSlugs {
  return {
    codeBySlug: new Map(bezirke.map((b) => [b.slug, b.code])),
    slugByCode: new Map(bezirke.map((b) => [b.code, b.slug])),
  };
}

/** Reads a shared link. Anything unusable falls back to its default and is reported. */
export function readMarketParams(
  params: ParamReader,
  slugs: BezirkSlugs,
  coverage: MarketCoverage,
): { filter: MarketFilter; issues: MarketUrlIssue[] } {
  const issues: MarketUrlIssue[] = [];
  const fallback = defaultFilter(coverage);

  const parts = (params.get("bezirke") ?? "").split(",").filter(Boolean);
  const codes: string[] = [];
  for (const slug of parts) {
    const code = slugs.codeBySlug.get(slug);
    if (code === undefined) {
      if (!issues.includes("bezirke")) issues.push("bezirke");
    } else if (!codes.includes(code)) {
      codes.push(code);
    }
  }
  if (codes.length > MAX_BEZIRKE) issues.push("too-many");

  const yearOf = (name: string, value: number) => {
    const raw = params.get(name);
    if (raw === null || raw === "") return { value, given: false };
    return { value: YEAR.test(raw) ? Number(raw) : Number.NaN, given: true };
  };
  const from = yearOf("from", fallback.from);
  const to = yearOf("to", fallback.to);
  const inRange = (y: number) => y >= coverage.firstYear && y <= coverage.lastYear;
  const periodValid = inRange(from.value) && inRange(to.value) && from.value <= to.value;
  if ((from.given || to.given) && !periodValid) issues.push("period");

  const type = readEnum(params, "type", TYPE_FILTERS, "all");
  if (type.invalid) issues.push("type");

  return {
    filter: {
      bezirke: codes.slice(0, MAX_BEZIRKE),
      from: periodValid ? from.value : fallback.from,
      to: periodValid ? to.value : fallback.to,
      type: type.value,
    },
    issues,
  };
}

/** "?bezirke=mitte,pankow&from=2023&type=loft", or "" for the defaults. */
export function marketQuery(filter: MarketFilter, slugs: BezirkSlugs, coverage: MarketCoverage): string {
  return buildQuery({
    bezirke: filter.bezirke.map((code) => slugs.slugByCode.get(code) ?? code),
    from: filter.from === coverage.firstYear ? null : String(filter.from),
    to: filter.to === coverage.lastYear ? null : String(filter.to),
    type: filter.type === "all" ? null : filter.type,
  });
}

// ---------- API ----------

export type MarketApiField = "bezirke" | "period" | "type";

/** The API query string for the fields a module uses. Bezirke are sorted: order only matters for color. */
export function apiSearch(filter: MarketFilter, fields: readonly MarketApiField[]): string {
  const search = new URLSearchParams();
  if (fields.includes("bezirke") && filter.bezirke.length > 0) search.set("bezirke", [...filter.bezirke].sort().join(","));
  if (fields.includes("period")) {
    search.set("from", String(filter.from));
    search.set("to", String(filter.to));
  }
  if (fields.includes("type")) search.set("type", filter.type);
  return search.toString();
}

export type ApiQueryResult = { ok: true; filter: MarketFilter } | { ok: false; message: string };

/** Strict parse for route handlers: bad input is a 400 with a reason, never a silent default. */
export function parseApiQuery(params: URLSearchParams, coverage: MarketCoverage): ApiQueryResult {
  const fallback = defaultFilter(coverage);

  const rawBezirke = params.get("bezirke");
  const bezirke = rawBezirke ? rawBezirke.split(",") : [];
  if (bezirke.some((code) => !BEZIRK_CODE.test(code))) {
    return { ok: false, message: "bezirke must be a comma-separated list of Bezirk codes 01–12." };
  }
  if (new Set(bezirke).size !== bezirke.length) return { ok: false, message: "bezirke lists a Bezirk twice." };
  if (bezirke.length > MAX_BEZIRKE) return { ok: false, message: `bezirke allows at most ${MAX_BEZIRKE} Bezirke.` };

  const year = (name: "from" | "to") => {
    const raw = params.get(name);
    if (raw === null) return fallback[name];
    return YEAR.test(raw) ? Number(raw) : Number.NaN;
  };
  const from = year("from");
  const to = year("to");
  if (!(from >= coverage.firstYear && to <= coverage.lastYear && from <= to)) {
    return {
      ok: false,
      message: `from and to must be years from ${coverage.firstYear} to ${coverage.lastYear}, with from ≤ to.`,
    };
  }

  const rawType = params.get("type") ?? "all";
  if (!(TYPE_FILTERS as readonly string[]).includes(rawType)) {
    return { ok: false, message: `type must be one of ${TYPE_FILTERS.join(", ")}.` };
  }

  return { ok: true, filter: { bezirke, from, to, type: rawType as MarketTypeFilter } };
}
