import type { ProvenanceKind } from "./provenance";

/** One dataset as /methodology#sources shows it (D-051). */
export interface DatasetEntry {
  /** The `## <id>` heading in data/PROVENANCE.md. */
  id: string;
  name: string;
  mark: Extract<ProvenanceKind, "official" | "not-connected" | "demo">;
  status: string;
  publisher: string | null;
  /** The service's base address, never a request that downloads the data. */
  service: string | null;
  license: { name: string; /** Short id, e.g. "dl-de/zero-2.0" */ id: string; href: string | null } | null;
  /** ISO date */
  retrieved: string | null;
  contents: string;
  sha256: string | null;
  notes: string[];
  use: string;
}
