import {
  API_MAJOR,
  errorEnvelopeV1,
  fastApiValidationError,
  rentPredictionResponseV1,
} from "@/lib/contracts/rent-prediction.v1";
import type { RentEstimateOutcome } from "./types";

/**
 * Maps an HTTP response from the prediction service (or our proxy) to an outcome.
 * Pure and synchronous so every status/body combination is unit-testable.
 */
export function interpretPredictionResponse(
  status: number,
  bodyText: string,
  requestId: string,
  headers: { get(name: string): string | null } = { get: () => null },
): RentEstimateOutcome {
  // A non-JSON error body (e.g. a gateway's HTML 502 page) still falls through to the status mapping.
  let body: unknown;
  try {
    body = bodyText === "" ? undefined : JSON.parse(bodyText);
  } catch {
    body = undefined;
  }

  if (status >= 200 && status < 300) {
    // Check the major version before the shape: a v2 body may not resemble v1 at all.
    const major = apiMajorOf(body);
    if (major !== null && major !== API_MAJOR) {
      return unavailable(requestId, "UNSUPPORTED_API_VERSION", "The prediction service uses a different API version.", false);
    }
    const parsed = rentPredictionResponseV1.safeParse(body);
    if (!parsed.success) {
      return unavailable(
        requestId,
        "INVALID_RESPONSE",
        "The prediction service answered in an unexpected format, so no estimate is shown.",
        false,
      );
    }
    // D-058: a client that cannot see the flag must not read its absence as "observed".
    const synthetic = parsed.data.model.training_data?.synthetic;
    if (synthetic === undefined) return { status: "not_connected", reason: "unverified_data", requestId };
    return { status: "ok", data: parsed.data, trainedOn: synthetic ? "synthetic" : "observed", requestId };
  }

  const envelope = errorEnvelopeV1.safeParse(body);
  if (envelope.success) {
    const { code, message, details, retryable } = envelope.data.error;
    if (code === "PREDICTION_ENGINE_NOT_CONFIGURED") {
      return { status: "not_connected", reason: "not_configured", requestId };
    }
    if (code === "VALIDATION_ERROR") {
      return { status: "invalid_input", issues: details ?? [], requestId };
    }
    if (code === "OUT_OF_SUPPORT") {
      return { status: "rejected", code, message, requestId };
    }
    const retryAfterMs = retryAfter(headers);
    return {
      status: "unavailable",
      code,
      message,
      retryable: retryable ?? (status === 429 || status === 503 || status === 504),
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
      requestId,
    };
  }

  // FastAPI's default validation body, until the service installs the envelope handler.
  if (status === 422) {
    const fastapi = fastApiValidationError.safeParse(body);
    if (fastapi.success) {
      return {
        status: "invalid_input",
        issues: fastapi.data.detail.map((d) => ({ field: String(d.loc.at(-1) ?? "request"), issue: d.msg })),
        requestId,
      };
    }
  }

  if (status === 429) return unavailable(requestId, "RATE_LIMITED", "Too many requests. Try again shortly.", true);
  if (status === 503) return unavailable(requestId, "MODEL_UNAVAILABLE", "The model is not available right now.", true);
  if (status === 504) return unavailable(requestId, "UPSTREAM_TIMEOUT", "The model took too long to answer.", true);
  return unavailable(requestId, "INTERNAL_ERROR", `The prediction service failed (HTTP ${status}).`, status >= 500);
}

function unavailable(requestId: string, code: string, message: string, retryable: boolean): RentEstimateOutcome {
  return { status: "unavailable", code, message, retryable, requestId };
}

function apiMajorOf(body: unknown): number | null {
  if (typeof body !== "object" || body === null || !("api_version" in body)) return null;
  const match = /^(\d+)\./.exec(String(body.api_version));
  return match ? Number(match[1]) : null;
}

function retryAfter(headers: { get(name: string): string | null }): number | undefined {
  const value = headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}
