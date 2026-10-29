import {
  apiSearch,
  createBezirkSlugs,
  defaultFilter,
  marketQuery,
  parseApiQuery,
  readMarketParams,
} from "@/lib/market/query";
import { getBezirkOptions } from "@/lib/data/geo";

const coverage = { firstYear: 2020, lastYear: 2025, types: [] };
const slugs = createBezirkSlugs(getBezirkOptions());
const read = (search: string) => readMarketParams(new URLSearchParams(search), slugs, coverage);

describe("market URL state", () => {
  it("defaults to all of Berlin, every year and all property types", () => {
    expect(read("")).toEqual({ filter: defaultFilter(coverage), issues: [] });
    expect(marketQuery(defaultFilter(coverage), slugs, coverage)).toBe("");
  });

  it("reads Bezirk slugs in order, the period and the type, and writes them back", () => {
    const { filter, issues } = read("bezirke=pankow,mitte&from=2022&to=2024&type=loft");
    expect(issues).toEqual([]);
    expect(filter).toEqual({ bezirke: ["03", "01"], from: 2022, to: 2024, type: "loft" });
    expect(marketQuery(filter, slugs, coverage)).toBe("?bezirke=pankow%2Cmitte&from=2022&to=2024&type=loft");
  });

  it("omits period ends that match the coverage", () => {
    expect(marketQuery({ bezirke: [], from: 2023, to: 2025, type: "all" }, slugs, coverage)).toBe("?from=2023");
  });

  it("drops unknown and repeated Bezirke, and keeps only the first four", () => {
    expect(read("bezirke=mitte,atlantis,mitte")).toEqual({
      filter: { ...defaultFilter(coverage), bezirke: ["01"] },
      issues: ["bezirke"],
    });
    const many = read("bezirke=mitte,pankow,spandau,neukoelln,lichtenberg");
    expect(many.filter.bezirke).toEqual(["01", "03", "05", "08"]);
    expect(many.issues).toEqual(["too-many"]);
  });

  it("falls back to every year for a period outside the coverage or backwards", () => {
    for (const search of ["from=2019", "to=2026", "from=2024&to=2021", "from=abc", "to=20245"]) {
      const { filter, issues } = read(search);
      expect(filter).toMatchObject({ from: 2020, to: 2025 });
      expect(issues).toEqual(["period"]);
    }
  });

  it("falls back to all types for an unknown type (other has no market series)", () => {
    expect(read("type=castle").issues).toEqual(["type"]);
    expect(read("type=other").filter.type).toBe("all");
  });
});

describe("market API query", () => {
  const filter = { bezirke: ["03", "01"], from: 2021, to: 2024, type: "house" as const };

  it("sends only the fields a module uses, with Bezirke sorted", () => {
    expect(apiSearch(filter, ["bezirke", "period", "type"])).toBe("bezirke=01%2C03&from=2021&to=2024&type=house");
    expect(apiSearch(filter, ["period"])).toBe("from=2021&to=2024");
    expect(apiSearch({ ...filter, bezirke: [] }, ["bezirke"])).toBe("");
  });

  it("parses a valid query and fills defaults", () => {
    expect(parseApiQuery(new URLSearchParams("bezirke=01,03&from=2021&to=2024&type=house"), coverage)).toEqual({
      ok: true,
      filter: { bezirke: ["01", "03"], from: 2021, to: 2024, type: "house" },
    });
    expect(parseApiQuery(new URLSearchParams(""), coverage)).toEqual({ ok: true, filter: defaultFilter(coverage) });
  });

  it("rejects bad input with a reason instead of guessing", () => {
    for (const search of [
      "bezirke=13",
      "bezirke=mitte",
      "bezirke=01,01",
      "bezirke=01,02,03,04,05",
      "from=2019",
      "from=2024&to=2022",
      "to=next",
      "type=other",
    ]) {
      const result = parseApiQuery(new URLSearchParams(search), coverage);
      expect(result.ok, search).toBe(false);
      if (!result.ok) expect(result.message.length).toBeGreaterThan(10);
    }
  });
});
