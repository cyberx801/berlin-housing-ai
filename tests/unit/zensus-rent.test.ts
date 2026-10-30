// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { getOrtsteilRent, ZENSUS_PROVENANCE, ZENSUS_RENT_META } from "@/lib/data/zensus";
import { getOrtsteile } from "@/lib/data/geo";

const ROOT = process.cwd();
const CSV = path.join(ROOT, "data/raw/zensus/Zensus2022_Durchschn_Nettokaltmiete_Anzahl_der_Wohnungen_100m-Gitter.csv");

describe("Zensus 2022 rent per Ortsteil (D-062)", () => {
  it("covers all 97 Ortsteile of the geodata", () => {
    for (const o of getOrtsteile()) expect(getOrtsteilRent(o.code), o.name).toBeDefined();
  });

  it("is official data under dl-de/by-2.0, dated to the census", () => {
    expect(ZENSUS_PROVENANCE).toMatchObject({ kind: "official", sourceId: "zensus-2022-rent-grid", license: "dl-de/by-2.0" });
    expect(ZENSUS_RENT_META.referenceDate).toBe("2022-05-15");
    expect(ZENSUS_RENT_META.attribution).toContain("Statistische Ämter des Bundes und der Länder");
  });

  it("agrees with the published Berlin average (7.67 €/m²) within a few cents", () => {
    expect(Math.abs(ZENSUS_RENT_META.berlinMeanRentPerM2 - 7.67)).toBeLessThan(0.1);
  });

  it("publishes a figure only where enough flats stand behind it, and keeps it in a sane range", () => {
    for (const o of getOrtsteile()) {
      const r = getOrtsteilRent(o.code)!;
      if (r.meanRentPerM2 === null) expect(r.dwellings, o.name).toBeLessThan(ZENSUS_RENT_META.minDwellings);
      else {
        expect(r.dwellings, o.name).toBeGreaterThanOrEqual(ZENSUS_RENT_META.minDwellings);
        expect(r.meanRentPerM2, o.name).toBeGreaterThan(4);
        expect(r.meanRentPerM2, o.name).toBeLessThan(15);
      }
    }
  });

  it("keeps the known order: large estates are cheaper than the villa districts", () => {
    const code = (name: string) => getOrtsteile().find((o) => o.name === name)!.code;
    const rent = (name: string) => getOrtsteilRent(code(name))!.meanRentPerM2!;
    expect(rent("Marzahn")).toBeLessThan(rent("Mitte"));
    expect(rent("Mitte")).toBeLessThan(rent("Grunewald"));
  });

  // The raw file is 73 MB and not in the repository, so this runs where the file has been downloaded.
  it.skipIf(!existsSync(CSV))("matches the checksum of the file it was built from", async () => {
    const { createHash } = await import("node:crypto");
    const generated = JSON.parse(
      readFileSync(path.join(ROOT, "src/lib/data/zensus/generated/zensus-rent.json"), "utf8"),
    ) as { fileSha256: string };
    expect(createHash("sha256").update(readFileSync(CSV)).digest("hex")).toBe(generated.fileSha256);
  });
});
