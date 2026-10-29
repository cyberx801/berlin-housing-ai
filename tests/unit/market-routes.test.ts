// @vitest-environment node
// Route handlers build Node Request/Response objects; jsdom would mix realms.
import { GET as districts } from "@/app/api/market/districts/route";
import { GET as distribution } from "@/app/api/market/distribution/route";
import { GET as propertyTypes } from "@/app/api/market/property-types/route";
import { GET as rentTrend } from "@/app/api/market/rent-trend/route";
import { demoMarketSource } from "@/lib/data/market/demo-source";
import { districtsSchema, histogramSchema, responseSchema, trendSchema, typesSchema } from "@/lib/market/schemas";

const get = (path: string) => new Request(`http://localhost/api/market/${path}`);

describe("/api/market/*", () => {
  it("answers each module with its data and the demo provenance", async () => {
    const cases = [
      [rentTrend, "rent-trend?bezirke=01,03&from=2024&to=2025&type=apartment", trendSchema],
      [districts, "districts?from=2020&to=2025&type=all", districtsSchema],
      [distribution, "distribution?bezirke=05&from=2022&to=2022&type=loft", histogramSchema],
      [propertyTypes, "property-types?from=2020&to=2025", typesSchema],
    ] as const;
    for (const [handler, path, schema] of cases) {
      const response = await handler(get(path));
      expect(response.status, path).toBe(200);
      expect(response.headers.get("cache-control")).toBe("no-store");
      const body = responseSchema(schema as typeof trendSchema).safeParse(await response.json());
      expect(body.success, path).toBe(true);
      expect(body.data?.provenance).toEqual(demoMarketSource.provenance);
    }
  });

  it("returns exactly what the source returns", async () => {
    const body = await (await rentTrend(get("rent-trend?bezirke=01&from=2025&to=2025&type=all"))).json();
    expect(body.data).toEqual(await demoMarketSource.rentTrend({ bezirke: ["01"], from: 2025, to: 2025, type: "all" }));
  });

  it("refuses a bad query with 400 and a reason", async () => {
    const response = await rentTrend(get("rent-trend?bezirke=01,02,03,04,05"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "INVALID_QUERY", message: "bezirke allows at most 4 Bezirke." },
    });
  });

  it("hides source failures behind a generic 500", async () => {
    const spy = vi.spyOn(demoMarketSource, "districtComparison").mockRejectedValueOnce(new Error("disk on fire"));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await districts(get("districts"));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toMatch(/disk/);
    spy.mockRestore();
    log.mockRestore();
  });
});
