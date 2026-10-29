import "server-only";
import { parseApiQuery, type MarketFilter } from "@/lib/market/query";
import { getMarketSource, type MarketDataSource } from "./index";

// Shared GET handler for /api/market/*: strict query parse (400 with a reason), then one
// source call wrapped with its provenance. Errors never leak internals to the client.

type Answer<T> = (source: MarketDataSource, filter: MarketFilter) => Promise<T>;

const json = (body: unknown, status: number) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function marketHandler<T>(answer: Answer<T>) {
  return async function GET(request: Request): Promise<Response> {
    const source = getMarketSource();
    const parsed = parseApiQuery(new URL(request.url).searchParams, source.coverage);
    if (!parsed.ok) return json({ error: { code: "INVALID_QUERY", message: parsed.message } }, 400);
    try {
      return json({ provenance: source.provenance, data: await answer(source, parsed.filter) }, 200);
    } catch (error) {
      console.error("Market source failed:", error);
      return json({ error: { code: "SOURCE_FAILED", message: "The market source could not answer." } }, 500);
    }
  };
}
