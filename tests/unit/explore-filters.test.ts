import {
  createLookups,
  EMPTY_EXPLORE_STATE,
  exploreQuery,
  foldQuery,
  isFiltered,
  NO_FILTER,
  placeMatcher,
  QUERY_MAX_LENGTH,
  readExploreParams,
  readPlaceFilter,
  searchKeys,
} from "@/features/neighborhood-explorer/filters";
import { getBerlinBbox, getExploreBezirke, getExplorePlaces } from "@/lib/data/geo";

const places = getExplorePlaces();
const bezirke = getExploreBezirke();
const lookups = createLookups(places, bezirke);
const names = (filter: Parameters<typeof placeMatcher>[0]) => places.filter(placeMatcher(filter)).map((p) => p.name);
const params = (search: string) => new URLSearchParams(search);

describe("explore data", () => {
  it("gives every Ortsteil its Bezirk slug, neighbours, label point and bounds", () => {
    expect(places).toHaveLength(97);
    const moabit = places.find((p) => p.slug === "moabit")!;
    expect(moabit).toMatchObject({ code: "0102", bezirkCode: "01", bezirkSlug: "mitte", bezirkName: "Mitte" });
    expect(moabit.neighbors.length).toBeGreaterThan(0);
    for (const code of moabit.neighbors) expect(places.some((p) => p.code === code)).toBe(true);
    const [w, s, e, n] = moabit.bbox;
    expect(moabit.labelPoint[0]).toBeGreaterThan(w);
    expect(moabit.labelPoint[0]).toBeLessThan(e);
    expect(moabit.labelPoint[1]).toBeGreaterThan(s);
    expect(moabit.labelPoint[1]).toBeLessThan(n);
  });

  it("frames all of Berlin", () => {
    const [w, s, e, n] = getBerlinBbox();
    for (const place of places) {
      expect(place.bbox[0]).toBeGreaterThanOrEqual(w);
      expect(place.bbox[1]).toBeGreaterThanOrEqual(s);
      expect(place.bbox[2]).toBeLessThanOrEqual(e);
      expect(place.bbox[3]).toBeLessThanOrEqual(n);
    }
  });
});

describe("name search", () => {
  it("folds case, accents, ß and hyphens", () => {
    expect(foldQuery("  NEUKÖLLN ")).toBe("neukolln");
    expect(foldQuery("Weißensee")).toBe("weissensee");
    expect(foldQuery("Alt-Hohenschönhausen")).toBe("alt hohenschonhausen");
  });

  it("finds a place by its accent-free and its transliterated spelling", () => {
    expect(searchKeys("Neukölln")).toEqual(["neukolln", "neukoelln"]);
    expect(names({ ...NO_FILTER, q: "neukolln" })).toEqual(["Neukölln"]);
    expect(names({ ...NO_FILTER, q: "Neukoelln" })).toEqual(["Neukölln"]);
    expect(names({ ...NO_FILTER, q: "weissen" })).toEqual(["Weißensee"]);
    expect(names({ ...NO_FILTER, q: "alt hohensch" })).toEqual(["Alt-Hohenschönhausen"]);
  });

  it("matches anywhere in the name", () => {
    expect(names({ ...NO_FILTER, q: "dorf" }).length).toBeGreaterThan(5);
    expect(names({ ...NO_FILTER, q: "zzz" })).toEqual([]);
  });
});

describe("filters", () => {
  it("matches everything when nothing is set, and a blank query is no filter", () => {
    expect(names(NO_FILTER)).toHaveLength(97);
    expect(isFiltered(NO_FILTER)).toBe(false);
    expect(isFiltered({ ...NO_FILTER, q: "   " })).toBe(false);
    expect(isFiltered({ ...NO_FILTER, ring: "inside" })).toBe(true);
  });

  it("combines Bezirk, ring status and name", () => {
    const mitte = names({ ...NO_FILTER, bezirk: "01" });
    expect(mitte).toEqual(expect.arrayContaining(["Mitte", "Moabit", "Wedding", "Gesundbrunnen"]));
    expect(mitte).toHaveLength(6);
    const inside = places.filter(placeMatcher({ ...NO_FILTER, ring: "inside" }));
    expect(inside.every((p) => p.ringStatus === "inside")).toBe(true);
    expect(names({ bezirk: "01", ring: "partly", q: "moa" })).toEqual(["Moabit"]);
    expect(names({ bezirk: "08", ring: null, q: "moabit" })).toEqual([]);
  });
});

describe("URL state", () => {
  it("reads slugs into codes", () => {
    const { state, invalid } = readExploreParams(params("o=moabit&bezirk=mitte&ring=partly&q=moa"), lookups);
    expect(state).toEqual({ selected: "0102", bezirk: "01", ring: "partly", q: "moa" });
    expect(invalid).toEqual([]);
  });

  it("drops unknown values and reports them", () => {
    const { state, invalid } = readExploreParams(params("o=atlantis&bezirk=nowhere&ring=sideways"), lookups);
    expect(state).toEqual(EMPTY_EXPLORE_STATE);
    expect(invalid).toEqual(["o", "bezirk", "ring"]);
  });

  it("treats a missing or empty parameter as unset, not invalid", () => {
    expect(readExploreParams(params(""), lookups)).toEqual({ state: EMPTY_EXPLORE_STATE, invalid: [] });
    expect(readExploreParams(params("o=&ring="), lookups)).toEqual({ state: EMPTY_EXPLORE_STATE, invalid: [] });
  });

  it("caps the query length", () => {
    const { filter } = readPlaceFilter(params(`q=${"a".repeat(200)}`), lookups);
    expect(filter.q).toHaveLength(QUERY_MAX_LENGTH);
  });

  it("writes slugs in a fixed order, leaves out what is unset and trims the query", () => {
    expect(exploreQuery(EMPTY_EXPLORE_STATE, lookups)).toBe("");
    expect(exploreQuery({ selected: "0102", bezirk: "01", ring: "inside", q: " prenzlauer berg " }, lookups)).toBe(
      "?o=moabit&bezirk=mitte&ring=inside&q=prenzlauer+berg",
    );
    expect(exploreQuery({ ...EMPTY_EXPLORE_STATE, q: "   " }, lookups)).toBe("");
  });

  it("round-trips", () => {
    const state = { selected: "0801", bezirk: "08", ring: "partly" as const, q: "neu" };
    expect(readExploreParams(params(exploreQuery(state, lookups).slice(1)), lookups).state).toEqual(state);
  });
});
