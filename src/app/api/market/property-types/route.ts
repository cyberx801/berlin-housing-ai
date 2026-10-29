import { marketHandler } from "@/lib/data/market/http";

// Every property type side by side; the type filter only highlights (D-040).
export const GET = marketHandler((source, { bezirke, from, to }) => source.propertyTypeComparison({ bezirke, from, to }));
