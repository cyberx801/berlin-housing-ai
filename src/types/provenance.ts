/**
 * Where a value came from. Every data-bearing component requires one (DATA_BOUNDARIES §1).
 */
export type Provenance =
  | {
      kind: "official";
      sourceId: string;
      label: string;
      license: string;
      /** ISO date */
      retrieved: string;
    }
  | {
      kind: "research";
      sourceId: string;
      label: string;
      validation: "pending" | "passed" | "failed";
    }
  | { kind: "demo"; fixtureId: string; note: string }
  | { kind: "user" }
  | { kind: "model"; modelVersion: string; dataReferenceDate: string }
  | { kind: "not-connected"; missing: string }
  | { kind: "pending"; reason: string };

export type ProvenanceKind = Provenance["kind"];
