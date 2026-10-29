import "server-only";
import { z } from "zod";
import { CONTRACT_VERSION, RENT_PREDICTION_PATH, rentPredictionRequestV1 } from "@/lib/contracts/rent-prediction.v1";
import { randomId } from "@/lib/id";
import { DEFAULT_TIMEOUT_MS } from "./config";

// Server-side half of `proxy` mode (PREDICTION_API.md §7). The upstream URL and key are read
// from server-only variables at request time and never reach the browser.

const MAX_BODY_BYTES = 16_384;
const REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

export interface ProxyEnv {
  /** Upstream FastAPI base URL; null means no model is configured. */
  baseUrl: string | null;
  apiKey: string | null;
  timeoutMs: number;
}

const envSchema = z.object({
  baseUrl: z.url({ protocol: /^https?$/ }).optional(),
  apiKey: z.string().min(1).optional(),
  timeoutMs: z.coerce.number().int().min(1_000).max(60_000).optional(),
});

export function readProxyEnv(
  env: Record<string, string | undefined> = {
    PREDICTION_API_BASE_URL: process.env.PREDICTION_API_BASE_URL,
    PREDICTION_API_KEY: process.env.PREDICTION_API_KEY,
    PREDICTION_TIMEOUT_MS: process.env.PREDICTION_TIMEOUT_MS,
  },
): ProxyEnv {
  const parsed = envSchema.safeParse({
    baseUrl: env.PREDICTION_API_BASE_URL || undefined,
    apiKey: env.PREDICTION_API_KEY || undefined,
    timeoutMs: env.PREDICTION_TIMEOUT_MS || undefined,
  });
  if (!parsed.success) {
    // A malformed value is treated as "not configured" rather than guessed at.
    console.error(
      `Prediction proxy: ignoring invalid configuration (${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}).`,
    );
    return { baseUrl: null, apiKey: null, timeoutMs: DEFAULT_TIMEOUT_MS };
  }
  return {
    baseUrl: parsed.data.baseUrl ?? null,
    apiKey: parsed.data.apiKey ?? null,
    timeoutMs: parsed.data.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  };
}

function headersFor(requestId: string, extra: Record<string, string> = {}) {
  return { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Request-ID": requestId, ...extra };
}

function errorResponse(
  status: number,
  requestId: string,
  error: { code: string; message: string; retryable: boolean; details?: { field: string; issue: string }[] },
) {
  return new Response(JSON.stringify({ api_version: CONTRACT_VERSION, request_id: requestId, error }), {
    status,
    headers: headersFor(requestId),
  });
}

/** Validates the request, forwards it to the configured model and passes the answer through. */
export async function proxyRentPrediction(
  request: Request,
  env: ProxyEnv,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<Response> {
  const incomingId = request.headers.get("x-request-id");
  const requestId = incomingId && REQUEST_ID.test(incomingId) ? incomingId : randomId();

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  const text = declaredLength > MAX_BODY_BYTES ? null : await request.text();
  if (text === null || new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return errorResponse(413, requestId, {
      code: "PAYLOAD_TOO_LARGE",
      message: `The request body must be under ${MAX_BODY_BYTES} bytes.`,
      retryable: false,
    });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return errorResponse(400, requestId, {
      code: "VALIDATION_ERROR",
      message: "The request body must be JSON.",
      retryable: false,
    });
  }

  const parsed = rentPredictionRequestV1.safeParse(body);
  if (!parsed.success) {
    return errorResponse(422, requestId, {
      code: "VALIDATION_ERROR",
      message: "The request does not match contract v1.",
      retryable: false,
      details: parsed.error.issues.map((i) => ({ field: i.path.join(".") || "request", issue: i.message })),
    });
  }

  if (env.baseUrl === null) {
    return errorResponse(503, requestId, {
      code: "PREDICTION_ENGINE_NOT_CONFIGURED",
      message: "No rent model is configured on this server.",
      retryable: false,
    });
  }

  const timeout = AbortSignal.timeout(env.timeoutMs);
  let upstream: Response;
  try {
    upstream = await fetchImpl(`${env.baseUrl.replace(/\/+$/, "")}${RENT_PREDICTION_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Request-ID": requestId,
        ...(env.apiKey ? { Authorization: `Bearer ${env.apiKey}` } : {}),
      },
      body: JSON.stringify(parsed.data),
      signal: timeout,
      cache: "no-store",
    });
  } catch {
    return timeout.aborted
      ? errorResponse(504, requestId, {
          code: "UPSTREAM_TIMEOUT",
          message: "The model took too long to answer.",
          retryable: true,
        })
      : errorResponse(502, requestId, {
          code: "UPSTREAM_UNREACHABLE",
          message: "The model could not be reached.",
          retryable: true,
        });
  }

  // Pass JSON through unchanged. Anything else (e.g. a gateway's HTML error page) is dropped,
  // so only the status reaches the browser and is mapped there exactly as in direct mode.
  const upstreamText = await upstream.text();
  let isJson = true;
  try {
    JSON.parse(upstreamText);
  } catch {
    isJson = false;
  }
  const retryAfter = upstream.headers.get("retry-after");
  return new Response(isJson ? upstreamText : null, {
    status: upstream.status,
    headers: headersFor(requestId, retryAfter ? { "Retry-After": retryAfter } : {}),
  });
}
