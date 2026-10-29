import "server-only";
import { z } from "zod";
import type {
  BezirkMeta,
  BezirkOption,
  ExploreBezirk,
  ExplorePlace,
  NeighborhoodProfile,
  OrtsteilMeta,
  OrtsteilOption,
  PlatePlace,
  Plates,
} from "@/types/geo";
import { RING_INSIDE_MIN, RING_OUTSIDE_MAX } from "@/lib/geo/ring";
import type { Provenance } from "@/types/provenance";
import bezirkeJson from "./generated/bezirke.meta.json";
import ortsteileJson from "./generated/ortsteile.meta.json";
import platesJson from "./generated/plates.geo.json";
import buildJson from "./generated/provenance.json";

// Generated files are validated on load so a broken build output fails loudly.
const point = z.tuple([z.number(), z.number()]);
const bbox = z.tuple([z.number(), z.number(), z.number(), z.number()]);

const ortsteilSchema = z.object({
  code: z.string().regex(/^\d{4}$/),
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  bezirkCode: z.string().regex(/^(0[1-9]|1[0-2])$/),
  areaKm2: z.number().positive(),
  ringShare: z.number().min(0).max(1),
  ringStatus: z.enum(["inside", "partly", "outside"]),
  neighbors: z.array(z.string()),
  labelPoint: point,
  bbox,
});

const bezirkSchema = z.object({
  code: z.string().regex(/^(0[1-9]|1[0-2])$/),
  name: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  areaKm2: z.number().positive(),
  labelPoint: point,
  bbox,
  ortsteilCodes: z.array(z.string()),
});

const ORTSTEILE: readonly OrtsteilMeta[] = z.array(ortsteilSchema).length(97).parse(ortsteileJson);
const BEZIRKE: readonly BezirkMeta[] = z.array(bezirkSchema).length(12).parse(bezirkeJson);

const ortsteilByCode = new Map(ORTSTEILE.map((o) => [o.code, o]));
const ortsteilBySlug = new Map(ORTSTEILE.map((o) => [o.slug, o]));
const bezirkByCode = new Map(BEZIRKE.map((b) => [b.code, b]));
const bezirkBySlug = new Map(BEZIRKE.map((b) => [b.slug, b]));

const PLATES = platesJson as unknown as Plates;
if (
  PLATES.ortsteile.features.length !== 97 ||
  PLATES.bezirke.features.length !== 12 ||
  PLATES.ring.features.length === 0 ||
  PLATES.outline.features.length === 0 ||
  PLATES.bezirkBorders.features.length === 0
) {
  throw new Error("plates.geo.json is incomplete; run npm run geo:build");
}

const buildSchema = z.object({
  generatedBy: z.string(),
  sources: z.array(z.object({ id: z.string(), file: z.string(), sha256: z.string().regex(/^[0-9a-f]{64}$/) })).min(1),
  retrieved: z.iso.date(),
  license: z.string(),
  rules: z.object({
    ringInsideMin: z.number(),
    ringOutsideMax: z.number(),
    plateSimplify: z.string().regex(/^\d+(\.\d+)?%$/),
    mapSimplify: z.string().regex(/^\d+(\.\d+)?%$/),
  }),
});

export type GeoBuildInfo = z.infer<typeof buildSchema>;

const BUILD: GeoBuildInfo = buildSchema.parse(buildJson);
// The copy on every page reads the shared constants; the build must have used the same ones.
if (BUILD.rules.ringInsideMin !== RING_INSIDE_MIN || BUILD.rules.ringOutsideMax !== RING_OUTSIDE_MAX) {
  throw new Error("provenance.json ring thresholds differ from src/lib/geo/ring.ts; run npm run geo:build");
}

export const GEO_PROVENANCE: Provenance = {
  kind: "official",
  sourceId: "alkis-ortsteile",
  label: "ALKIS Berlin and Umweltzone (Geoportal Berlin)",
  license: "dl-de/zero-2.0",
  retrieved: "2026-10-29",
};

export function getOrtsteile(): readonly OrtsteilMeta[] {
  return ORTSTEILE;
}

export function getBezirke(): readonly BezirkMeta[] {
  return BEZIRKE;
}

export function getOrtsteil(code: string): OrtsteilMeta | undefined {
  return ortsteilByCode.get(code);
}

export function getOrtsteilBySlug(slug: string): OrtsteilMeta | undefined {
  return ortsteilBySlug.get(slug);
}

export function getBezirk(code: string): BezirkMeta | undefined {
  return bezirkByCode.get(code);
}

export function getBezirkBySlug(slug: string): BezirkMeta | undefined {
  return bezirkBySlug.get(slug);
}

export function getPlates(): Plates {
  return PLATES;
}

/** What the geodata build read (files and checksums) and the rules it applied. */
export function getGeoBuildInfo(): GeoBuildInfo {
  return BUILD;
}

/** Readout rows for the plates, sorted by name (German collation). */
export function getPlatePlaces(): PlatePlace[] {
  return ORTSTEILE.map((o) => ({
    code: o.code,
    name: o.name,
    slug: o.slug,
    bezirkCode: o.bezirkCode,
    bezirkName: bezirkByCode.get(o.bezirkCode)?.name ?? o.bezirkCode,
    areaKm2: o.areaKm2,
    ringShare: o.ringShare,
    ringStatus: o.ringStatus,
  })).sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export function getExplorePlaces(): ExplorePlace[] {
  return getPlatePlaces().map((place) => {
    const meta = ortsteilByCode.get(place.code)!;
    return {
      ...place,
      bezirkSlug: bezirkByCode.get(place.bezirkCode)?.slug ?? "",
      neighbors: meta.neighbors,
      labelPoint: meta.labelPoint,
      bbox: meta.bbox,
    };
  });
}

export function getNeighborhoodProfile(slug: string): NeighborhoodProfile | undefined {
  const meta = ortsteilBySlug.get(slug);
  if (!meta) return undefined;
  const byCode = new Map(getExplorePlaces().map((p) => [p.code, p]));
  return {
    place: byCode.get(meta.code)!,
    neighbors: meta.neighbors
      .map((code) => byCode.get(code))
      .filter((p): p is ExplorePlace => p !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name, "de")),
  };
}

export function getExploreBezirke(): ExploreBezirk[] {
  return BEZIRKE.map(({ code, name, slug, labelPoint, bbox }) => ({ code, name, slug, labelPoint, bbox })).sort(
    (a, b) => a.name.localeCompare(b.name, "de"),
  );
}

/** [west, south, east, north] around all of Berlin. */
export function getBerlinBbox(): [number, number, number, number] {
  return [
    Math.min(...BEZIRKE.map((b) => b.bbox[0])),
    Math.min(...BEZIRKE.map((b) => b.bbox[1])),
    Math.max(...BEZIRKE.map((b) => b.bbox[2])),
    Math.max(...BEZIRKE.map((b) => b.bbox[3])),
  ];
}

export function getBezirkOptions(): BezirkOption[] {
  return BEZIRKE.map(({ code, name, slug }) => ({ code, name, slug })).sort((a, b) =>
    a.name.localeCompare(b.name, "de"),
  );
}

export function getOrtsteilOptions(): OrtsteilOption[] {
  return ORTSTEILE.map(({ code, name, slug, bezirkCode }) => ({ code, name, slug, bezirkCode })).sort(
    (a, b) => a.name.localeCompare(b.name, "de"),
  );
}
