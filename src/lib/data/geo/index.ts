import "server-only";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { z } from "zod";
import type { BezirkMeta, BezirkOption, OrtsteilMeta, OrtsteilOption } from "@/types/geo";
import type { Provenance } from "@/types/provenance";
import bezirkeJson from "./generated/bezirke.meta.json";
import ortsteileJson from "./generated/ortsteile.meta.json";
import platesJson from "./generated/plates.geo.json";

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

export type PlateFeatureCollection = FeatureCollection<Polygon | MultiPolygon, { code?: string }>;
export interface Plates {
  ortsteile: PlateFeatureCollection;
  bezirke: PlateFeatureCollection;
  ring: PlateFeatureCollection;
}
const PLATES = platesJson as unknown as Plates;

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
