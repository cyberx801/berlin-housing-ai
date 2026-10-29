// Derives typed, simplified geodata from the official raw downloads in data/raw/geo.
// Rules: docs/architecture/DATA_BOUNDARIES.md §6 · Registry: data/PROVENANCE.md
// Usage: npm run geo:build
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { geoArea } from "d3-geo";
import mapshaper from "mapshaper";
import { neighbors as topoNeighbors } from "topojson-client";
import {
  bezirkCodeFromSch,
  ortsteilCodeFromSch,
  pointInGeometry,
  rewindForD3,
  ringStatusFromShare,
  slugify,
  toFeatureCollection,
} from "./lib/geo-derive.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RAW = path.join(ROOT, "data/raw/geo");
const OUT_SERVER = path.join(ROOT, "src/lib/data/geo/generated");
const OUT_PUBLIC = path.join(ROOT, "public/geo");

const OFFICIAL_BERLIN_AREA_KM2 = 891.1; // Amt für Statistik Berlin-Brandenburg; sanity bound only
const EXPECTED = { bezirke: 12, ortsteile: 97 };

// Simplification levels (share of removable vertices retained, Visvalingam weighted).
const PLATE_SIMPLIFY = "1.6%"; // SVG plates: home hero, locators, silhouettes
const MAP_SIMPLIFY = "9%"; // MapLibre on /explore
const BUDGET = {
  platesRawBytes: 260_000, // server-only JSON (rendered into SVG paths)
  publicGzipBytes: 300_000, // all of public/geo, gzip
};

const failures = [];
function check(condition, message) {
  if (!condition) failures.push(message);
}

async function readRaw(file) {
  const buf = await readFile(path.join(RAW, file));
  return {
    json: JSON.parse(buf.toString("utf8")),
    sha256: createHash("sha256").update(buf).digest("hex"),
  };
}

async function ms(commands, input) {
  // mapshaper may mutate its input cache; give every run its own copy.
  const out = await mapshaper.applyCommands(commands, structuredClone(input));
  return Object.fromEntries(
    Object.entries(out).map(([k, v]) => [k, typeof v === "string" ? v : v.toString("utf8")]),
  );
}

const round = (n, digits) => Math.round(n * 10 ** digits) / 10 ** digits;

async function main() {
  const [bezirkeRaw, ortsteileRaw, ringRaw] = await Promise.all([
    readRaw("alkis_bezirke.geojson"),
    readRaw("alkis_ortsteile.geojson"),
    readRaw("umweltzone.geojson"),
  ]);
  const input = {
    "bezirke.json": bezirkeRaw.json,
    "ortsteile.json": ortsteileRaw.json,
    "ring.json": ringRaw.json,
  };

  check(bezirkeRaw.json.features.length === EXPECTED.bezirke, "expected 12 Bezirke");
  check(ortsteileRaw.json.features.length === EXPECTED.ortsteile, "expected 97 Ortsteile");
  check(ringRaw.json.features.length === 1, "expected 1 Umweltzone feature");

  // 1. Geodesic areas, interior points and bounds from the RAW geometry (never ALKIS `gdf`, D-010).
  const ortsteilStats = JSON.parse(
    (
      await ms(
        `-i ortsteile.json -each "area_m2=this.area, ix=this.innerX, iy=this.innerY, bounds=this.bounds" -filter-fields sch,nam,area_m2,ix,iy,bounds -o ortsteile.stats.json format=json`,
        input,
      )
    )["ortsteile.stats.json"],
  );
  const bezirkStats = JSON.parse(
    (
      await ms(
        `-i bezirke.json -each "area_m2=this.area, ix=this.innerX, iy=this.innerY, bounds=this.bounds" -filter-fields gem,namgem,area_m2,ix,iy,bounds -o bezirke.stats.json format=json`,
        input,
      )
    )["bezirke.stats.json"],
  );

  // 2. Area inside the Umweltzone (the area within the S-Bahn ring, D-011).
  const clipped = JSON.parse(
    (
      await ms(
        `-i ortsteile.json -clip ring.json -each "inside_m2=this.area" -filter-fields sch,inside_m2 -o clipped.json format=json`,
        input,
      )
    )["clipped.json"],
  );
  const insideBySch = new Map();
  for (const r of clipped) insideBySch.set(r.sch, (insideBySch.get(r.sch) ?? 0) + r.inside_m2);

  // 3. Topological adjacency on the unsimplified topology (shared arcs only; point contacts excluded).
  const topo = JSON.parse(
    (await ms(`-i ortsteile.json snap -o ortsteile.topo.json format=topojson no-quantization`, input))[
      "ortsteile.topo.json"
    ],
  );
  const topoGeoms = Object.values(topo.objects)[0].geometries;
  const adjacency = topoNeighbors(topoGeoms);
  const schByTopoIndex = topoGeoms.map((g) => g.properties.sch);

  // 4. Bezirke metadata.
  const bezirke = bezirkStats
    .map((b) => ({
      code: b.gem.slice(-2),
      name: b.namgem,
      slug: slugify(b.namgem),
      areaKm2: round(b.area_m2 / 1e6, 2),
      labelPoint: [round(b.ix, 5), round(b.iy, 5)],
      bbox: b.bounds.map((v) => round(v, 5)),
      ortsteilCodes: [],
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
  const bezirkByCode = new Map(bezirke.map((b) => [b.code, b]));
  const bezirkGeomByCode = new Map(
    bezirkeRaw.json.features.map((f) => [f.properties.gem.slice(-2), f.geometry]),
  );

  // 5. Ortsteile metadata.
  const codeBySch = new Map(ortsteilStats.map((o) => [o.sch, ortsteilCodeFromSch(o.sch)]));
  const ortsteile = ortsteilStats
    .map((o) => {
      const code = ortsteilCodeFromSch(o.sch);
      const bezirkCode = bezirkCodeFromSch(o.sch);
      const share = Math.min(1, (insideBySch.get(o.sch) ?? 0) / o.area_m2);
      const topoIndex = schByTopoIndex.indexOf(o.sch);
      const neighborCodes = (adjacency[topoIndex] ?? [])
        .map((i) => codeBySch.get(schByTopoIndex[i]))
        .sort();

      // Cross-check the sch-derived Bezirk with point-in-polygon on a guaranteed interior point.
      const geom = bezirkGeomByCode.get(bezirkCode);
      check(
        geom !== undefined && pointInGeometry([o.ix, o.iy], geom),
        `${o.nam}: interior point not inside Bezirk ${bezirkCode} derived from sch`,
      );

      return {
        code,
        name: o.nam,
        slug: slugify(o.nam),
        bezirkCode,
        areaKm2: round(o.area_m2 / 1e6, 2),
        ringShare: round(share, 3),
        ringStatus: ringStatusFromShare(share),
        neighbors: neighborCodes,
        labelPoint: [round(o.ix, 5), round(o.iy, 5)],
        bbox: o.bounds.map((v) => round(v, 5)),
      };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  for (const o of ortsteile) bezirkByCode.get(o.bezirkCode)?.ortsteilCodes.push(o.code);

  // 6. Asserts (DATA_BOUNDARIES §6, FRONTEND_ARCHITECTURE §6).
  check(new Set(ortsteile.map((o) => o.slug)).size === ortsteile.length, "Ortsteil slugs not unique");
  check(new Set(bezirke.map((b) => b.slug)).size === bezirke.length, "Bezirk slugs not unique");
  check(new Set(ortsteile.map((o) => o.code)).size === ortsteile.length, "Ortsteil codes not unique");
  for (const o of ortsteile) {
    check(bezirkByCode.has(o.bezirkCode), `${o.name}: unknown Bezirk ${o.bezirkCode}`);
    check(o.neighbors.length > 0, `${o.name}: no neighbors found`);
    for (const n of o.neighbors) {
      const other = ortsteile.find((x) => x.code === n);
      check(other?.neighbors.includes(o.code) === true, `adjacency not symmetric: ${o.code}↔${n}`);
    }
  }
  for (const b of bezirke) {
    const sum = ortsteile.filter((o) => o.bezirkCode === b.code).reduce((s, o) => s + o.areaKm2, 0);
    check(
      Math.abs(sum - b.areaKm2) / b.areaKm2 < 0.005,
      `${b.name}: Ortsteil area sum ${sum.toFixed(2)} vs Bezirk ${b.areaKm2} (>0.5%)`,
    );
  }
  const totalKm2 = ortsteile.reduce((s, o) => s + o.areaKm2, 0);
  check(
    Math.abs(totalKm2 - OFFICIAL_BERLIN_AREA_KM2) / OFFICIAL_BERLIN_AREA_KM2 < 0.01,
    `total area ${totalKm2.toFixed(1)} km² not within 1% of ${OFFICIAL_BERLIN_AREA_KM2}`,
  );

  // 7. Simplified geometry (topology-preserving: shared arcs simplified once; Bezirke dissolved
  //    from the simplified Ortsteile so their outlines coincide exactly).
  const simplifyCmd = (level, precision, suffix) =>
    `-i ortsteile.json snap name=ortsteile -each "code=sch.slice(-4), bezirk=sch.slice(6,8)" -filter-fields code,bezirk ` +
    `-simplify ${level} weighted keep-shapes -dissolve bezirk + name=bezirke ` +
    `-o target=ortsteile,bezirke format=geojson precision=${precision} ${suffix}`;
  const plateOut = await ms(simplifyCmd(PLATE_SIMPLIFY, 0.0001, ""), input);
  const mapOut = await ms(simplifyCmd(MAP_SIMPLIFY, 0.00001, ""), input);
  const ringPlate = await ms(`-i ring.json -simplify 6% keep-shapes -filter-fields -o ring.json format=geojson precision=0.0001`, input);
  const ringMap = await ms(`-i ring.json -simplify 20% keep-shapes -filter-fields -o ring.json format=geojson precision=0.00001`, input);

  const parse = (out, key) => toFeatureCollection(JSON.parse(out[key]));
  const ortsteilByCode = new Map(ortsteile.map((o) => [o.code, o]));

  // Plates are projected with d3-geo, which needs clockwise exterior rings.
  const platesOrtsteile = parse(plateOut, "ortsteile.json");
  const platesBezirke = parse(plateOut, "bezirke.json");
  const plates = {
    ortsteile: {
      type: "FeatureCollection",
      features: platesOrtsteile.features.map((f) => ({
        type: "Feature",
        properties: { code: f.properties.code },
        geometry: rewindForD3(f.geometry),
      })),
    },
    bezirke: {
      type: "FeatureCollection",
      features: platesBezirke.features.map((f) => ({
        type: "Feature",
        properties: { code: f.properties.bezirk },
        geometry: rewindForD3(f.geometry),
      })),
    },
    ring: {
      type: "FeatureCollection",
      features: parse(ringPlate, "ring.json").features.map((f) => ({
        type: "Feature",
        properties: { name: "Umweltzone" },
        geometry: rewindForD3(f.geometry),
      })),
    },
  };
  // A feature read with the wrong winding covers almost the whole sphere (> 2π sr).
  for (const [layer, fc] of Object.entries(plates)) {
    for (const f of fc.features) {
      check(geoArea(f) < 1e-3, `plates.${layer}: feature ${f.properties.code ?? ""} has d3 winding error`);
    }
  }

  const mapOrtsteile = parse(mapOut, "ortsteile.json");
  const mapBezirke = parse(mapOut, "bezirke.json");
  const publicFiles = {
    "ortsteile.geojson": {
      type: "FeatureCollection",
      features: mapOrtsteile.features.map((f) => {
        const o = ortsteilByCode.get(f.properties.code);
        return {
          type: "Feature",
          id: Number(o.code),
          properties: {
            code: o.code,
            name: o.name,
            slug: o.slug,
            bezirkCode: o.bezirkCode,
            ringStatus: o.ringStatus,
          },
          geometry: f.geometry,
        };
      }),
    },
    "bezirke.geojson": {
      type: "FeatureCollection",
      features: mapBezirke.features.map((f) => {
        const b = bezirkByCode.get(f.properties.bezirk);
        return {
          type: "Feature",
          id: Number(b.code),
          properties: { code: b.code, name: b.name, slug: b.slug },
          geometry: f.geometry,
        };
      }),
    },
    "ring.geojson": parse(ringMap, "ring.json"),
  };

  check(plates.ortsteile.features.length === 97, "plate Ortsteile lost features");
  check(plates.bezirke.features.length === 12, "plate Bezirke dissolve produced wrong count");
  check(publicFiles["ortsteile.geojson"].features.length === 97, "map Ortsteile lost features");

  // 8. Budgets.
  const platesJson = JSON.stringify(plates);
  check(
    platesJson.length <= BUDGET.platesRawBytes,
    `plates.geo.json ${platesJson.length} B exceeds ${BUDGET.platesRawBytes} B`,
  );
  const publicSerialized = Object.fromEntries(
    Object.entries(publicFiles).map(([k, v]) => [k, JSON.stringify(v)]),
  );
  const publicGzip = Object.values(publicSerialized).reduce((s, v) => s + gzipSync(v).length, 0);
  check(publicGzip <= BUDGET.publicGzipBytes, `public/geo gzip ${publicGzip} B exceeds budget`);

  if (failures.length) {
    console.error(`geo:build FAILED (${failures.length})`);
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }

  // 9. Write.
  const provenance = {
    generatedBy: "scripts/build-geo.mjs",
    sources: [
      { id: "alkis-bezirke", file: "data/raw/geo/alkis_bezirke.geojson", sha256: bezirkeRaw.sha256 },
      { id: "alkis-ortsteile", file: "data/raw/geo/alkis_ortsteile.geojson", sha256: ortsteileRaw.sha256 },
      { id: "umweltzone", file: "data/raw/geo/umweltzone.geojson", sha256: ringRaw.sha256 },
    ],
    retrieved: "2026-10-29",
    license: "dl-de/zero-2.0",
    rules: { ringInsideMin: 0.95, ringOutsideMax: 0.05, plateSimplify: PLATE_SIMPLIFY, mapSimplify: MAP_SIMPLIFY },
  };

  await mkdir(OUT_SERVER, { recursive: true });
  await mkdir(OUT_PUBLIC, { recursive: true });
  await Promise.all([
    writeFile(path.join(OUT_SERVER, "ortsteile.meta.json"), JSON.stringify(ortsteile, null, 1) + "\n"),
    writeFile(path.join(OUT_SERVER, "bezirke.meta.json"), JSON.stringify(bezirke, null, 1) + "\n"),
    writeFile(path.join(OUT_SERVER, "plates.geo.json"), platesJson),
    writeFile(path.join(OUT_SERVER, "provenance.json"), JSON.stringify(provenance, null, 2) + "\n"),
    ...Object.entries(publicSerialized).map(([file, body]) => writeFile(path.join(OUT_PUBLIC, file), body)),
  ]);

  const counts = { inside: 0, partly: 0, outside: 0 };
  for (const o of ortsteile) counts[o.ringStatus] += 1;
  console.log("geo:build OK");
  console.log(`  Ortsteile ${ortsteile.length}, Bezirke ${bezirke.length}, total ${totalKm2.toFixed(1)} km²`);
  console.log(`  Ring status: inside ${counts.inside}, partly ${counts.partly}, outside ${counts.outside}`);
  console.log(`  plates.geo.json ${(platesJson.length / 1024).toFixed(0)} kB raw`);
  for (const [k, v] of Object.entries(publicSerialized)) {
    console.log(`  public/geo/${k} ${(v.length / 1024).toFixed(0)} kB raw, ${(gzipSync(v).length / 1024).toFixed(0)} kB gzip`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
