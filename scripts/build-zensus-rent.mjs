// Aggregates the Zensus 2022 grid of average net cold rent (100 m cells, with the number of dwellings)
// to the 97 Berlin Ortsteile. Rules and caveats: docs/architecture/DATA_BOUNDARIES.md §9 · Registry: data/PROVENANCE.md
// Usage: npm run zensus:build   (the CSV goes in data/raw/zensus/, see PROVENANCE.md for where to get it)
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { pointInGeometry, ortsteilCodeFromSch } from "./lib/geo-derive.mjs";
import { laeaToLonLat } from "./lib/laea.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CSV = path.join(ROOT, "data/raw/zensus/Zensus2022_Durchschn_Nettokaltmiete_Anzahl_der_Wohnungen_100m-Gitter.csv");
const ORTSTEILE = path.join(ROOT, "data/raw/geo/alkis_ortsteile.geojson");
const OUT = path.join(ROOT, "src/lib/data/zensus/generated/zensus-rent.json");

// Berlin in EPSG:3035 with a margin (so the box also holds Potsdam and other neighbours: those cells land in "outside").
const BBOX = { minE: 4_525_000, maxE: 4_582_000, minN: 3_248_000, maxN: 3_297_000 };
const MIN_DWELLINGS = 100; // below this an Ortsteil's figure is not published (a handful of cells decide it)
const BERLIN_REFERENCE = { value: 7.67, source: "Zensus 2022, Berlin, durchschnittliche Nettokaltmiete" }; // sanity bound only

const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

const sha256 = createHash("sha256").update(await readFile(CSV)).digest("hex");

const geo = JSON.parse(await readFile(ORTSTEILE, "utf8"));
const places = geo.features.map((f) => {
  const ring = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates).flatMap((p) => p[0]);
  const lons = ring.map((c) => c[0]);
  const lats = ring.map((c) => c[1]);
  return {
    code: ortsteilCodeFromSch(f.properties.sch),
    name: f.properties.nam,
    geometry: f.geometry,
    bbox: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)],
    dwellings: 0,
    rentSum: 0,
    flaggedDwellings: 0,
    cells: 0,
  };
});
check(places.length === 97, `expected 97 Ortsteile, found ${places.length}`);

const stats = { rows: 0, inBbox: 0, assigned: 0, outside: 0, flags: {} };
const lines = readline.createInterface({ input: createReadStream(CSV, "utf8"), crlfDelay: Infinity });
let header = null;
for await (const line of lines) {
  if (header === null) {
    header = line.split(";");
    check(header.join(";") === "GITTER_ID_100m;x_mp_100m;y_mp_100m;durchschnMieteQM;AnzahlWohnungen;werterlaeuternde_Zeichen", `unexpected header: ${line}`);
    continue;
  }
  stats.rows += 1;
  const [, xs, ys, rentStr, countStr, flag] = line.split(";");
  const e = Number(xs);
  const n = Number(ys);
  if (e < BBOX.minE || e > BBOX.maxE || n < BBOX.minN || n > BBOX.maxN) continue;
  stats.inBbox += 1;
  const rent = Number(rentStr.replace(",", "."));
  const count = Number(countStr);
  if (!Number.isFinite(rent) || !Number.isFinite(count) || count <= 0) {
    stats.flags[`unusable:${rentStr}/${countStr}`] = (stats.flags[`unusable:${rentStr}/${countStr}`] ?? 0) + 1;
    continue;
  }
  const { lon, lat } = laeaToLonLat(e, n);
  const hit = places.find(
    (p) => lon >= p.bbox[0] && lon <= p.bbox[2] && lat >= p.bbox[1] && lat <= p.bbox[3] && pointInGeometry([lon, lat], p.geometry),
  );
  if (!hit) {
    stats.outside += 1;
    continue;
  }
  stats.assigned += 1;
  stats.flags[flag || "(none)"] = (stats.flags[flag || "(none)"] ?? 0) + 1;
  hit.cells += 1;
  hit.dwellings += count;
  hit.rentSum += rent * count;
  if (flag) hit.flaggedDwellings += count;
}

const round2 = (x) => Math.round(x * 100) / 100;
const totalDwellings = places.reduce((s, p) => s + p.dwellings, 0);
const berlinMean = places.reduce((s, p) => s + p.rentSum, 0) / totalDwellings;
check(
  Math.abs(berlinMean - BERLIN_REFERENCE.value) < 0.25,
  `Berlin weighted mean ${berlinMean.toFixed(2)} is not close to the published ${BERLIN_REFERENCE.value} €/m²`,
);
check(stats.assigned > 20_000, `only ${stats.assigned} cells fell inside an Ortsteil`);

const ortsteile = places
  .map((p) => ({
    code: p.code,
    name: p.name,
    cells: p.cells,
    dwellings: p.dwellings,
    flaggedShare: p.dwellings ? round2(p.flaggedDwellings / p.dwellings) : 0,
    meanRentPerM2: p.dwellings >= MIN_DWELLINGS ? round2(p.rentSum / p.dwellings) : null,
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

check(
  ortsteile.every((o) => o.meanRentPerM2 === null || (o.meanRentPerM2 > 3 && o.meanRentPerM2 < 20)),
  "an Ortsteil mean is outside 3 to 20 €/m²",
);
for (const o of ortsteile) if (o.meanRentPerM2 === null) console.warn(`not published (under ${MIN_DWELLINGS} dwellings): ${o.name} (${o.dwellings})`);

if (failures.length) {
  console.error(failures.map((f) => `✗ ${f}`).join("\n"));
  process.exit(1);
}

const out = {
  sourceId: "zensus-2022-rent-grid",
  label: "Zensus 2022, durchschnittliche Nettokaltmiete in Gitterzellen (100 m)",
  attribution: "Ergebnisse des Zensus 2022, Statistische Ämter des Bundes und der Länder",
  license: "dl-de/by-2.0",
  referenceDate: "2022-05-15",
  retrieved: "2026-10-30",
  fileSha256: sha256,
  minDwellings: MIN_DWELLINGS,
  berlin: { meanRentPerM2: round2(berlinMean), dwellings: totalDwellings, cells: stats.assigned },
  ortsteile,
};
await mkdir(path.dirname(OUT), { recursive: true });
await writeFile(OUT, `${JSON.stringify(out, null, 1)}\n`);
console.log(
  `rows ${stats.rows}, in Berlin bbox ${stats.inBbox}, in an Ortsteil ${stats.assigned}, outside ${stats.outside}; flags ${JSON.stringify(stats.flags)}\n` +
    `Berlin weighted mean ${round2(berlinMean)} €/m² over ${totalDwellings} dwellings (published: ${BERLIN_REFERENCE.value}); wrote ${path.relative(ROOT, OUT)}`,
);
