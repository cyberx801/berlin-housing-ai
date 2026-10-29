import { getBezirkOptions, getOrtsteilOptions } from "@/lib/data/geo";
import { readAnalyzePrefill } from "@/lib/validation/prefill";

const bezirke = getBezirkOptions();
const ortsteile = getOrtsteilOptions();
const codeOf = (slug: string) => bezirke.find((b) => b.slug === slug)!.code;
const read = (query: string) => readAnalyzePrefill(new URLSearchParams(query), bezirke, ortsteile);

describe("readAnalyzePrefill (Flow 1 entry, D-030)", () => {
  it("maps slugs to codes and keeps valid numbers exactly as typed", () => {
    expect(read("bezirk=mitte&type=apartment&area=65,5&rooms=2.5")).toEqual({
      values: { bezirk: codeOf("mitte"), propertyType: "apartment", area: "65,5", rooms: "2.5" },
      ignored: [],
    });
  });

  it("drops every invalid value and reports it, never guessing a replacement", () => {
    expect(read("bezirk=atlantis&type=castle&area=abc&rooms=2.25")).toEqual({
      values: {},
      ignored: ["bezirk", "type", "area", "rooms"],
    });
    expect(read("area=5000&rooms=0").ignored).toEqual(["area", "rooms"]);
  });

  it("an Ortsteil alone is enough to fill in its Bezirk", () => {
    expect(read("ortsteil=moabit").values).toEqual({ ortsteil: "0102", bezirk: codeOf("mitte") });
  });

  it("ignores an Ortsteil that is not in the given Bezirk and keeps the Bezirk", () => {
    expect(read("bezirk=pankow&ortsteil=moabit")).toEqual({
      values: { bezirk: codeOf("pankow") },
      ignored: ["ortsteil"],
    });
  });

  it("treats empty and whitespace-only parameters as absent", () => {
    expect(read("bezirk=&area=%20%20&rooms=")).toEqual({ values: {}, ignored: [] });
    expect(read("")).toEqual({ values: {}, ignored: [] });
  });
});
