import type { RentPredictionRequestV1 } from "@/lib/contracts/rent-prediction.v1";
import { interpretPredictionResponse } from "./interpret";
import type { PredictionTransport, RentEstimateOutcome, SendOptions } from "./types";

/** Default transport: nothing is sent anywhere. Returns a typed outcome, never throws. */
export function createDisabledTransport(): PredictionTransport {
  return {
    mode: "disabled",
    async send(_request: RentPredictionRequestV1, { requestId }: SendOptions): Promise<RentEstimateOutcome> {
      return { status: "not_connected", reason: "disabled", requestId };
    },
  };
}

interface HttpTransportOptions {
  endpoint: string;
  mode: "direct" | "proxy";
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

/** Sends the request to a FastAPI service (direct) or to our server-side proxy route. */
export function createHttpTransport({
  endpoint,
  mode,
  timeoutMs,
  fetchImpl,
}: HttpTransportOptions): PredictionTransport {
  return {
    mode,
    async send(request, { requestId, signal }) {
      const doFetch = fetchImpl ?? globalThis.fetch.bind(globalThis);
      const timeout = AbortSignal.timeout(timeoutMs);
      const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
      let response: Response;
      try {
        response = await doFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Request-ID": requestId },
          body: JSON.stringify(request),
          signal: combined,
        });
      } catch {
        if (timeout.aborted) {
          return {
            status: "unavailable",
            code: "CLIENT_TIMEOUT",
            message: "The prediction service did not answer in time.",
            retryable: true,
            requestId,
          };
        }
        if (signal?.aborted) {
          return {
            status: "unavailable",
            code: "ABORTED",
            message: "The request was cancelled.",
            retryable: false,
            requestId,
          };
        }
        return {
          status: "unavailable",
          code: "NETWORK_ERROR",
          message: "The prediction service could not be reached.",
          retryable: true,
          requestId,
        };
      }
      const text = await response.text();
      return interpretPredictionResponse(response.status, text, requestId, response.headers);
    },
  };
}
