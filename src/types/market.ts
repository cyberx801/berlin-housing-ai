import type { Provenance } from "./provenance";

/** Property types the market data covers. "Other" has no market series. */
export const MARKET_TYPES = ["apartment", "maisonette", "penthouse", "loft", "house"] as const;
export type MarketType = (typeof MARKET_TYPES)[number];
export type MarketTypeFilter = MarketType | "all";

/** Two-digit Bezirk code, "01"–"12". */
export type BezirkCode = string;

/** Whole calendar years, both ends included. */
export interface MarketPeriod {
  from: number;
  to: number;
}

/** What a market source can answer: its years and property types. */
export interface MarketCoverage {
  firstYear: number;
  lastYear: number;
  types: readonly MarketType[];
}

export interface TrendQuery extends MarketPeriod {
  /** Empty means all of Berlin as one series. */
  bezirke: BezirkCode[];
  type: MarketTypeFilter;
}
export interface DistrictQuery extends MarketPeriod {
  type: MarketTypeFilter;
}
export interface DistributionQuery extends MarketPeriod {
  /** Combined; empty means all of Berlin. */
  bezirke: BezirkCode[];
  type: MarketTypeFilter;
}
export interface TypeComparisonQuery extends MarketPeriod {
  /** Combined; empty means all of Berlin. */
  bezirke: BezirkCode[];
}

export interface TrendSeries {
  /** A Bezirk code, or "berlin". */
  key: string;
  /** One median €/m² per month from `firstMonth`; null where there were no listings. */
  values: (number | null)[];
}
export interface TrendResult {
  /** "YYYY-MM" */
  firstMonth: string;
  series: TrendSeries[];
  /** Requested keys with no values at all in the period. */
  missing: string[];
}

export interface DistrictValue {
  code: BezirkCode;
  median: number | null;
  listings: number;
}

export interface PriceHistogram {
  /** Lower edge of the first bin and the bin width, in €/m². */
  binMin: number;
  binWidth: number;
  counts: number[];
  total: number;
  median: number | null;
}

export interface TypeValue {
  type: MarketType;
  listings: number;
  median: number | null;
  q1: number | null;
  q3: number | null;
}

/** What every market endpoint returns: the data and where it came from. */
export interface MarketResponse<T> {
  provenance: Provenance;
  data: T;
}
