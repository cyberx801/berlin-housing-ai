import { marketHandler } from "@/lib/data/market/http";

// Median €/m² over the period for all 12 Bezirke; the Bezirk filter only highlights (D-040).
export const GET = marketHandler((source, { from, to, type }) => source.districtComparison({ from, to, type }));
