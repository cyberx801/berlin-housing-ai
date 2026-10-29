import type { FeatureCollection, LineString, MultiLineString, MultiPolygon, Polygon } from "geojson";

export type RingStatus = "inside" | "partly" | "outside";

/** Plate geometry (lon/lat, wound for d3-geo). `code` is the Ortsteil or Bezirk code. */
export type PlateFeatureCollection = FeatureCollection<Polygon | MultiPolygon, { code?: string; name?: string }>;
export type PlateLineCollection = FeatureCollection<LineString | MultiLineString>;

export interface Plates {
  ortsteile: PlateFeatureCollection;
  bezirke: PlateFeatureCollection;
  /** Umweltzone: the official area within the S-Bahn ring. */
  ring: PlateFeatureCollection;
  /** Berlin's outer boundary. */
  outline: PlateFeatureCollection;
  /** Borders shared by two Bezirke, each drawn once. */
  bezirkBorders: PlateLineCollection;
}

/** One Ortsteil, derived from official ALKIS geometry by scripts/build-geo.mjs. */
export interface OrtsteilMeta {
  /** Official 4-digit Ortsteil number, e.g. "0102". */
  code: string;
  name: string;
  slug: string;
  /** "01"–"12" */
  bezirkCode: string;
  /** Geodesic area computed from geometry (never ALKIS `gdf`). */
  areaKm2: number;
  /** Share of the area inside the Umweltzone (area within the S-Bahn ring), 0–1. */
  ringShare: number;
  ringStatus: RingStatus;
  /** Codes of Ortsteile sharing a boundary segment. */
  neighbors: string[];
  labelPoint: [number, number];
  bbox: [number, number, number, number];
}

export interface BezirkMeta {
  code: string;
  name: string;
  slug: string;
  areaKm2: number;
  labelPoint: [number, number];
  bbox: [number, number, number, number];
  ortsteilCodes: string[];
}

/** What the plate readout shows for one Ortsteil (passed to the client plate). */
export interface PlatePlace {
  code: string;
  name: string;
  slug: string;
  bezirkCode: string;
  bezirkName: string;
  areaKm2: number;
  ringShare: number;
  ringStatus: RingStatus;
}

/** One Ortsteil as `/explore` needs it: list row, details panel, map label and camera target. */
export interface ExplorePlace extends PlatePlace {
  bezirkSlug: string;
  /** Codes of adjacent Ortsteile. */
  neighbors: string[];
  labelPoint: [number, number];
  bbox: [number, number, number, number];
}

/** One `/neighborhoods/[slug]` page: the Ortsteil and the Ortsteile it borders. */
export interface NeighborhoodProfile {
  place: ExplorePlace;
  /** Sorted by name (German collation). */
  neighbors: ExplorePlace[];
}

export interface ExploreBezirk {
  code: string;
  name: string;
  slug: string;
  labelPoint: [number, number];
  bbox: [number, number, number, number];
}

/** Minimal option shapes passed from server pages to client forms. */
export interface BezirkOption {
  code: string;
  name: string;
  slug: string;
}
export interface OrtsteilOption {
  code: string;
  name: string;
  slug: string;
  bezirkCode: string;
}
