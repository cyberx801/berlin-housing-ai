import { defineConfig, devices } from "@playwright/test";

// E2E against the demo model built into the Next.js server (NEXT_PUBLIC_PREDICTION_MODE=embedded, D-061), the way it runs on Netlify.
//   NEXT_DIST_DIR=.next-live NEXT_PUBLIC_PREDICTION_MODE=embedded npm run build
//   npx playwright test -c playwright.live.config.ts
// The mode is inlined at build time, which is why this suite has its own build folder.
const WEB_PORT = 3101;

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
      command: `npx next start --port ${WEB_PORT}`,
      url: `http://localhost:${WEB_PORT}`,
      env: { NEXT_DIST_DIR: ".next-live" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
