import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// E2E against the real local rent service (services/rent-api), through the Next.js proxy.
//   NEXT_DIST_DIR=.next-live NEXT_PUBLIC_PREDICTION_MODE=proxy npm run build
//   npx playwright test -c playwright.live.config.ts
// The mode is inlined at build time, which is why this suite has its own build folder.
const root = path.dirname(fileURLToPath(import.meta.url));
const WEB_PORT = 3101;
const API_PORT = 8000;
const python = path.join(root, "services/rent-api/.venv/Scripts/python.exe");

export default defineConfig({
  testDir: "tests/live",
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "live-375", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, hasTouch: true } },
    { name: "live-768", use: { ...devices["Desktop Chrome"], viewport: { width: 768, height: 1024 } } },
    { name: "live-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: `"${python}" -m uvicorn rent_api.main:app --port ${API_PORT}`,
      cwd: path.join(root, "services/rent-api"),
      url: `http://127.0.0.1:${API_PORT}/api/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx next start --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      env: { NEXT_DIST_DIR: ".next-live", PREDICTION_API_BASE_URL: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
