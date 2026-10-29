export type RingStatus = "inside" | "partly" | "outside";

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
