import type {
  DistributionQuery,
  DistrictQuery,
  DistrictValue,
  MarketCoverage,
  PriceHistogram,
  TrendQuery,
  TrendResult,
  TypeComparisonQuery,
  TypeValue,
} from "@/types/market";
import type { Provenance } from "@/types/provenance";

/**
 * Everything the `/market` dashboard can ask (DATA_BOUNDARIES §5). The demo implementation
 * answers from seeded fixtures; a validated dataset replaces it in `./index.ts`, and the UI
 * labels follow its `provenance`.
 */
export interface MarketDataSource {
  readonly provenance: Provenance;
  readonly coverage: MarketCoverage;
  /** Monthly median €/m², one series per Bezirk (or one for all of Berlin). */
  rentTrend(q: TrendQuery): Promise<TrendResult>;
  /** Median €/m² over the period for every Bezirk. */
  districtComparison(q: DistrictQuery): Promise<DistrictValue[]>;
  /** Listings by €/m² over the period, for the chosen Bezirke combined. */
  priceDistribution(q: DistributionQuery): Promise<PriceHistogram>;
  /** Median and quartiles of €/m² per property type, for the chosen Bezirke combined. */
  propertyTypeComparison(q: TypeComparisonQuery): Promise<TypeValue[]>;
}
