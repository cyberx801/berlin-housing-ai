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

/** The label for one provenance value. A model trained on synthetic data reads "Demo model" (D-058). */
export function provenanceCopy(p: Provenance): { label: string; href: string } {
  if (p.kind === "model" && p.trainedOn === "synthetic") return { label: "Demo model", href: "/methodology#predictions" };
  return PROVENANCE_COPY[p.kind];
}

/** True for the provenance that is drawn with the hatched demo band. */
export const isDemoBand = (p: Provenance) => p.kind === "demo" || (p.kind === "model" && p.trainedOn === "synthetic");

export function provenanceDetail(p: Provenance): string | null {
  switch (p.kind) {
    case "official":
      return `${p.label}, ${p.license}`;
    case "research":
      return `${p.label}, validation ${p.validation}`;
    case "demo":
      return p.note;
    case "model":
      return p.trainedOn === "synthetic"
        ? `Trained on synthetic data. Model ${p.modelVersion}, data up to ${p.dataReferenceDate}`
        : `Model ${p.modelVersion}, data up to ${p.dataReferenceDate}`;
    case "not-connected":
      return p.missing;
    case "pending":
      return p.reason;
    case "user":
      return null;
  }
}
