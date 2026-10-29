import type { Provenance, ProvenanceKind } from "@/types/provenance";

/** Fixed copy and methodology anchors per provenance kind (DESIGN_SYSTEM §7). */
export const PROVENANCE_COPY: Record<ProvenanceKind, { label: string; href: string }> = {
  official: { label: "Official data", href: "/methodology#sources" },
  research: { label: "Research dataset", href: "/methodology#sources" },
  user: { label: "From your entries", href: "/methodology#your-data" },
  demo: { label: "Demo data, not Berlin market statistics", href: "/methodology#market-data" },
  model: { label: "Model estimate", href: "/methodology#predictions" },
  "not-connected": { label: "Not connected", href: "/methodology#in-development" },
  pending: { label: "Not written yet", href: "/methodology#neighborhood-content" },
};

export function provenanceDetail(p: Provenance): string | null {
  switch (p.kind) {
    case "official":
      return `${p.label}, ${p.license}`;
    case "research":
      return `${p.label}, validation ${p.validation}`;
    case "demo":
      return p.note;
    case "model":
      return `Model ${p.modelVersion}, data up to ${p.dataReferenceDate}`;
    case "not-connected":
      return p.missing;
    case "pending":
      return p.reason;
    case "user":
      return null;
  }
}
