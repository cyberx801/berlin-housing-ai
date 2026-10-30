import type { RentPredictionRequestV1, RentPredictionResponseV1 } from "@/lib/contracts/rent-prediction.v1";

export type PredictionMode = "disabled" | "direct" | "proxy";

export interface FieldIssue {
  field: string;
  issue: string;
}

/** Every possible result of asking for a rent estimate. The UI renders all of them. */
export type RentEstimateOutcome =
  | { status: "ok"; data: RentPredictionResponseV1; trainedOn: "observed" | "synthetic"; requestId: string }
  | {
      status: "not_connected";
      /** `unverified_data`: the service answered but did not say its model was trained on synthetic data (D-058). */
      reason: "disabled" | "not_configured" | "unverified_data";
      requestId: string;
    }
  | { status: "invalid_input"; issues: FieldIssue[]; requestId: string }
  | { status: "rejected"; code: string; message: string; requestId: string }
  | {
      status: "unavailable";
      code: string;
      message: string;
      retryable: boolean;
      retryAfterMs?: number;
      requestId: string;
    };

export interface SendOptions {
  requestId: string;
  signal?: AbortSignal;
}

export interface PredictionTransport {
  readonly mode: PredictionMode;
  send(request: RentPredictionRequestV1, options: SendOptions): Promise<RentEstimateOutcome>;
}
