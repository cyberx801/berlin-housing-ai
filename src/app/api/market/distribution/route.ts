import { marketHandler } from "@/lib/data/market/http";

// Listings by €/m² for the chosen Bezirke combined, or all of Berlin (D-040).
export const GET = marketHandler((source, { bezirke, from, to, type }) =>
  source.priceDistribution({ bezirke, from, to, type }),
);
