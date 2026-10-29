import "server-only";
import type { MarketCoverage, MarketResponse } from "@/types/market";
import type { Provenance } from "@/types/provenance";
import { demoMarketSource } from "./demo-source";
import type { MarketDataSource } from "./source";

export type { MarketDataSource } from "./source";

/**
 * The market source the app uses. Swapping in a validated dataset happens here and nowhere
 * else (DATA_BOUNDARIES §5); every label follows the new source's `provenance`.
 */
export function getMarketSource(): MarketDataSource {
  return demoMarketSource;
}

export function getMarketProvenance(): Provenance {
  return getMarketSource().provenance;
}

export function getMarketCoverage(): MarketCoverage {
  return getMarketSource().coverage;
}

/** Wraps a source answer with the provenance it came from (the shape every endpoint returns). */
export async function withProvenance<T>(answer: (source: MarketDataSource) => Promise<T>): Promise<MarketResponse<T>> {
  const source = getMarketSource();
  return { provenance: source.provenance, data: await answer(source) };
}
