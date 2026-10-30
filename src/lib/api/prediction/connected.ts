import { readPredictionConfig } from "./config";

/**
 * Whether this build has a rent model behind Analyze. The mode is inlined at build time, so
 * static pages can say what the build really does instead of a fixed "not connected".
 * The only model that exists is the demo trained on synthetic data (D-058), and the client shows
 * nothing from a response that does not say so.
 */
export const rentModelConnected = (() => {
  try {
    return readPredictionConfig().mode !== "disabled";
  } catch {
    return false;
  }
})();
