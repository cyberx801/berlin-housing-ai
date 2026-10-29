import { z } from "zod";
import { RENT_PREDICTION_PATH } from "@/lib/contracts/rent-prediction.v1";
import type { PredictionMode } from "./types";

export const PROXY_ENDPOINT = "/api/predictions/rent";
export const DEFAULT_TIMEOUT_MS = 10_000;

export interface PredictionConfig {
  mode: PredictionMode;
  /** Absolute endpoint (direct) or same-origin path (proxy). Null when disabled. */
  endpoint: string | null;
  timeoutMs: number;
}

const envSchema = z.object({
  mode: z.enum(["disabled", "direct", "proxy"]).default("disabled"),
  baseUrl: z.url().optional(),
});

/**
 * Reads the client-side prediction config. NEXT_PUBLIC_* values are inlined at build time,
 * so they must be referenced literally and changing them requires a rebuild.
 */
export function readPredictionConfig(
  env: { mode?: string | undefined; baseUrl?: string | undefined } = {
    mode: process.env.NEXT_PUBLIC_PREDICTION_MODE,
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  },
): PredictionConfig {
  const parsed = envSchema.safeParse({
    mode: env.mode || undefined,
    baseUrl: env.baseUrl || undefined,
  });
  if (!parsed.success) {
    throw new Error(
      `Invalid prediction configuration: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  const { mode, baseUrl } = parsed.data;
  if (mode === "direct") {
    if (!baseUrl) {
      throw new Error("NEXT_PUBLIC_PREDICTION_MODE=direct requires NEXT_PUBLIC_API_BASE_URL.");
    }
    return {
      mode,
      endpoint: `${baseUrl.replace(/\/+$/, "")}${RENT_PREDICTION_PATH}`,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    };
  }
  if (mode === "proxy") return { mode, endpoint: PROXY_ENDPOINT, timeoutMs: DEFAULT_TIMEOUT_MS };
  return { mode: "disabled", endpoint: null, timeoutMs: DEFAULT_TIMEOUT_MS };
}
