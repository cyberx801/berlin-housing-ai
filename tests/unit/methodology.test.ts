import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { METHODOLOGY_IDS } from "@/features/methodology/sections";
import { getGeoBuildInfo } from "@/lib/data/geo";
import { getDatasetRegistry } from "@/lib/data/registry";

const ROOT = path.resolve(__dirname, "../..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

/** `## <id>` headings of data/PROVENANCE.md, each with the text up to the next heading. */
function provenanceSections(): Map<string, string> {
  const text = readFileSync(path.join(ROOT, "data/PROVENANCE.md"), "utf8");
  const sections = new Map<string, string>();
  for (const part of text.split(/^## /m).slice(1)) {
    // Headings can carry a suffix ("kaggle-berlin-5csv — NOT PRESENT"); the id is the first token.
    const id = part.split(/\s/, 1)[0]!;
    sections.set(id, part);
  }
  return sections;
}

describe("methodology anchors", () => {
  it("has unique section ids", () => {
    expect(new Set(METHODOLOGY_IDS).size).toBe(METHODOLOGY_IDS.length);
  });

  it("has a section for every /methodology# link in src/", () => {
    const links = sourceFiles(path.join(ROOT, "src")).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(/\/methodology#([a-z0-9-]+)/g)].map((m) => ({
        file: path.relative(ROOT, file),
        id: m[1]!,
      })),
    );
    // The provenance bands alone link to seven sections; a scan that finds none is broken.
    expect(links.length).toBeGreaterThanOrEqual(7);
    for (const link of links) expect(METHODOLOGY_IDS, `${link.file} → #${link.id}`).toContain(link.id);
  });
});

describe("dataset registry", () => {
  const registry = getDatasetRegistry();
  const sections = provenanceSections();

  it("lists every dataset in data/PROVENANCE.md, and nothing else", () => {
    expect(registry.map((d) => d.id).sort()).toEqual([...sections.keys()].sort());
  });

  it("shows the checksums the geodata build read, and they match data/PROVENANCE.md", () => {
    const build = getGeoBuildInfo();
    for (const source of build.sources) {
      const entry = registry.find((d) => d.id === source.id);
      expect(entry?.sha256, source.id).toBe(source.sha256);
      expect(sections.get(source.id), source.id).toContain(source.sha256);
    }
    // Only the downloaded official files have checksums.
    expect(registry.filter((d) => d.sha256 !== null).map((d) => d.id)).toEqual(build.sources.map((s) => s.id));
  });

  it("agrees with data/PROVENANCE.md on retrieval dates, licenses and services", () => {
    for (const entry of registry) {
      const section = sections.get(entry.id)!;
      if (entry.retrieved) expect(section, entry.id).toContain(entry.retrieved);
      if (entry.license) {
        // The licence is named the way the section writes it: "dl-de/zero-2.0", "Apache 2.0".
        const written = entry.license.id === "Apache-2.0" ? /Apache 2\.0/ : /dl-de\/zero-2[.-]0/;
        expect(section, entry.id).toMatch(written);
      }
      if (entry.service) expect(section, entry.id).toContain(entry.service);
      if (entry.mark === "official") expect(entry.retrieved, entry.id).not.toBeNull();
    }
  });

  it("names the demo fixture's seed as PROVENANCE.md does, and marks it as demo", () => {
    const demo = registry.find((d) => d.id === "demo-market-v1")!;
    expect(demo.mark).toBe("demo");
    const seed = /seed `(\d+)`/.exec(sections.get("demo-market-v1")!)?.[1];
    expect(seed).toBeDefined();
    expect(demo.contents).toContain(seed);
  });

  it("links services by their base address, never a download request", () => {
    for (const entry of registry) {
      if (entry.service) expect(entry.service, entry.id).not.toMatch(/[?&]REQUEST=/i);
    }
  });

  it("quotes the raw area field the methodology copy uses", () => {
    // MethodologyPage shows Blankenfelde's own area field (139 m²) next to its computed area.
    const ortsteile = JSON.parse(readFileSync(path.join(ROOT, "data/raw/geo/alkis_ortsteile.geojson"), "utf8")) as {
      features: { properties: { nam: string; gdf: number } }[];
    };
    const page = readFileSync(path.join(ROOT, "src/app/methodology/page.tsx"), "utf8");
    const quoted = /slug: "blankenfelde", ownFieldM2: (\d+)/.exec(page)?.[1];
    expect(ortsteile.features.find((f) => f.properties.nam === "Blankenfelde")?.properties.gdf).toBe(Number(quoted));
  });
});
