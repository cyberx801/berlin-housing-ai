import {
  rentPredictionRequestV1,
  toRentPredictionRequest,
  type NameLookup,
  type RentPredictionRequestV1,
} from "@/lib/contracts/rent-prediction.v1";
import { randomId } from "@/lib/id";
import type { PropertyInput } from "@/lib/validation/property";
import { readPredictionConfig, type PredictionConfig } from "./config";
import { createDisabledTransport, createHttpTransport } from "./transports";
import type { PredictionTransport, RentEstimateOutcome } from "./types";

export interface PreparedRequest {
  requestId: string;
  payload: RentPredictionRequestV1;
}

/**
 * The single entry point between the property form and any rent model.
 * Separates: input (PropertyInput) → wire request (contract) → transport → typed outcome.
 */
export class PropertyAnalysisService {
  constructor(
    private readonly transport: PredictionTransport,
    private readonly names: NameLookup,
    private readonly newId: () => string = randomId,
  ) {}

  get mode() {
    return this.transport.mode;
  }

  /** Builds and validates the exact payload the model would receive. */
  prepare(input: PropertyInput): PreparedRequest {
    const payload = rentPredictionRequestV1.parse(toRentPredictionRequest(input, this.names));
    return { requestId: this.newId(), payload };
  }

  async estimateRent(prepared: PreparedRequest, signal?: AbortSignal): Promise<RentEstimateOutcome> {
    const check = rentPredictionRequestV1.safeParse(prepared.payload);
    if (!check.success) {
      return {
        status: "invalid_input",
        issues: check.error.issues.map((i) => ({ field: i.path.join("."), issue: i.message })),
        requestId: prepared.requestId,
      };
    }
    return this.transport.send(check.data, {
      requestId: prepared.requestId,
      ...(signal ? { signal } : {}),
    });
  }
}

export function createTransport(config: PredictionConfig = readPredictionConfig()): PredictionTransport {
  if (config.mode === "disabled" || config.endpoint === null) return createDisabledTransport();
  return createHttpTransport({ endpoint: config.endpoint, mode: config.mode, timeoutMs: config.timeoutMs });
}
