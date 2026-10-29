import { marketHandler } from "@/lib/data/market/http";

// Monthly median €/m² per chosen Bezirk, or for all of Berlin (DATA_BOUNDARIES §5).
export const GET = marketHandler((source, { bezirke, from, to, type }) => source.rentTrend({ bezirke, from, to, type }));
