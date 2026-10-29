import { proxyRentPrediction, readProxyEnv } from "@/lib/api/prediction/proxy";

// `proxy` mode endpoint (PREDICTION_API.md §7). Without PREDICTION_API_BASE_URL it answers
// 503 PREDICTION_ENGINE_NOT_CONFIGURED; it never estimates anything itself.
export async function POST(request: Request): Promise<Response> {
  return proxyRentPrediction(request, readProxyEnv());
}
