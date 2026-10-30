import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// The parent home folder has an unrelated package-lock.json; pin the workspace root
// so Turbopack never resolves or watches outside this project (DECISIONS D-003).
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // The live-service E2E (playwright.live.config.ts) builds into its own folder, so it never
  // overwrites the default build the other E2E projects run against.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  outputFileTracingRoot: projectRoot,
  poweredByHeader: false,
  turbopack: {
    root: projectRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
