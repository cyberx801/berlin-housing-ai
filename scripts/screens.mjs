// Screenshot review helper (TASKS definition of done, step 3).
// Usage: node scripts/screens.mjs [--fold] [baseUrl] [route ...]   (--fold: first viewport only)
// Writes full-page PNGs at 375, 768 and 1440 px to test-results/screens (gitignored).
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const fold = args[0] === "--fold";
const [baseUrl = "http://localhost:3100", ...routes] = fold ? args.slice(1) : args;
const WIDTHS = [375, 768, 1440];
const outDir = path.resolve("test-results/screens");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
  for (const route of routes.length ? routes : ["/"]) {
    await page.goto(new URL(route, baseUrl).href, { waitUntil: "networkidle" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const name = `${route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}-${width}${fold ? "-fold" : ""}.png`;
    await page.screenshot({ path: path.join(outDir, name), fullPage: !fold });
    console.log(`${name}${overflow > 0 ? `  horizontal overflow ${overflow}px` : ""}`);
  }
  await page.close();
}
await browser.close();
