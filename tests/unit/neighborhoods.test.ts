import { renderToStaticMarkup } from "react-dom/server";
import NeighborhoodProfilePage, { generateStaticParams } from "@/app/neighborhoods/[slug]/page";
import { locatorShowsRing } from "@/components/maps/LocatorPlate";
import { createLookups, placeFilterQuery } from "@/features/neighborhood-explorer/filters";
import { bezirkPhrase, profileDescription } from "@/features/neighborhoods/profile-text";
import { getBezirkOptions, getNeighborhoodProfile, getOrtsteile, getPlates, getPlatePlaces } from "@/lib/data/geo";
import { placeLabels } from "@/lib/geo/labels";

const profile = (slug: string) => {
  const found = getNeighborhoodProfile(slug);
  if (!found) throw new Error(`no profile for ${slug}`);
  return found;
};

describe("neighborhood profiles", () => {
  it("prerenders exactly the 97 Ortsteil slugs", () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(97);
    expect(new Set(params.map((p) => p.slug))).toEqual(new Set(getOrtsteile().map((o) => o.slug)));
  });

  it("builds every profile from the geodata, neighbors sorted by name", () => {
    for (const { slug, neighbors } of getOrtsteile()) {
      const p = profile(slug);
      expect(p.place.slug).toBe(slug);
      expect(p.neighbors.map((n) => n.code).sort()).toEqual([...neighbors].sort());
      const names = p.neighbors.map((n) => n.name);
      expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "de")));
    }
    expect(getNeighborhoodProfile("not-a-place")).toBeUndefined();
    expect(getNeighborhoodProfile("Moabit")).toBeUndefined();
  });

  it("names the Bezirk without reading as circular when the names match", () => {
    expect(bezirkPhrase(profile("moabit").place)).toBe("Mitte");
    expect(bezirkPhrase(profile("mitte").place)).toBe("the Bezirk Mitte");
    expect(bezirkPhrase(profile("neukoelln").place)).toBe("the Bezirk Neukölln");
  });

  it("describes a profile with official facts only, never market values", () => {
    // Units are joined with a narrow no-break space.
    expect(profileDescription(profile("moabit")).replaceAll(" ", " ")).toBe(
      "Moabit is an Ortsteil of Mitte, 7.7 km² in area and partly inside the S-Bahn ring (83 % of its area). It borders 6 Ortsteile: Charlottenburg, Charlottenburg-Nord, Hansaviertel, Mitte, Tiergarten and Wedding. From the official ALKIS boundaries.",
    );
    for (const { slug } of getOrtsteile()) expect(profileDescription(profile(slug))).not.toMatch(/€|\/m²|rent/i);
  });

  it("renders the honest modules and no market figures on a profile", async () => {
    const html = renderToStaticMarkup(await NeighborhoodProfilePage({ params: Promise.resolve({ slug: "moabit" }) }));
    expect(html).toContain("Demo data, not Berlin market statistics");
    expect(html).toContain("Not connected");
    expect(html).toContain("Not written yet");
    expect(html).toContain('href="/market?bezirke=mitte"');
    expect(html).toContain('href="/analyze?bezirk=mitte&amp;ortsteil=moabit"');
    expect(html).toContain('href="/explore?o=moabit"');
    // The one real figure is the census rent, labeled as such. No demo market or model figure appears.
    expect(html).toContain("What did tenants in Moabit pay in 2022?");
    expect(html).toContain("not asking rents");
    expect(html).not.toContain("Demo model");
    const euroFigures = html.match(/€[\d.,]+/g) ?? [];
    expect(euroFigures).toHaveLength(2); // Moabit and all of Berlin, both from the census
  });

  it("knows when the ring crosses a locator plate", () => {
    const codes = (slug: string) => {
      const p = profile(slug);
      return [p.place.code, ...p.neighbors.map((n) => n.code)];
    };
    expect(locatorShowsRing(getPlates(), codes("moabit"))).toBe(true);
    expect(locatorShowsRing(getPlates(), codes("blankenfelde"))).toBe(false);
  });
});

describe("placeLabels", () => {
  const frame = { width: 480, height: 360, renderedWidth: 480 };

  it("keeps the first of two colliding labels and drops labels that run off the plate", () => {
    const kept = placeLabels(
      [
        { code: "a", name: "Moabit", xy: [200, 180], bold: true },
        { code: "b", name: "Hansaviertel", xy: [210, 185] },
        { code: "c", name: "Tiergarten", xy: [300, 100] },
        { code: "d", name: "Friedrichshain", xy: [470, 100] },
      ],
      frame,
    );
    expect([...kept]).toEqual(["a", "c"]);
  });

  it("drops more labels on a narrower plate, and a wider set contains the narrower one", () => {
    const candidates = [
      { code: "a", name: "Köpenick", xy: [240, 180] as [number, number], bold: true },
      { code: "b", name: "Friedrichshagen", xy: [330, 150] as [number, number] },
      { code: "c", name: "Oberschöneweide", xy: [160, 150] as [number, number] },
    ];
    const narrow = placeLabels(candidates, { ...frame, renderedWidth: 288 }, new Set(["a"]));
    const wide = placeLabels(candidates, { ...frame, renderedWidth: 448 }, narrow);
    expect(narrow.has("a")).toBe(true);
    expect(narrow.size).toBeLessThan(wide.size);
    for (const code of narrow) expect(wide.has(code)).toBe(true);
  });
});

describe("placeFilterQuery", () => {
  const lookups = createLookups(getPlatePlaces(), getBezirkOptions());

  it("writes Bezirk slugs and leaves out what isn't set", () => {
    expect(placeFilterQuery({ bezirk: null, ring: null, q: "" }, lookups)).toBe("");
    expect(placeFilterQuery({ bezirk: "01", ring: "inside", q: " moa " }, lookups)).toBe(
      "?bezirk=mitte&ring=inside&q=moa",
    );
  });
});
