// Writes the seeded demo market fixture (docs/architecture/DATA_BOUNDARIES.md §5).
// Usage: npm run fixtures:build            regenerate src/lib/fixtures/demo/market-v1.json
//        npm run fixtures:build -- --check  fail if the committed file differs from a fresh build
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDemoMarket, serializeDemoMarket } from "./lib/demo-market.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "src/lib/fixtures/demo/market-v1.json");

const text = serializeDemoMarket(buildDemoMarket());

if (process.argv.includes("--check")) {
  const current = await readFile(OUT, "utf8").catch(() => "");
  if (current.replace(/\r\n/g, "\n") !== text) {
    console.error(`${path.relative(ROOT, OUT)} is out of date. Run npm run fixtures:build.`);
    process.exit(1);
  }
  console.log(`${path.relative(ROOT, OUT)} matches the generator.`);
} else {
  await writeFile(OUT, text);
  console.log(`Wrote ${path.relative(ROOT, OUT)} (${(Buffer.byteLength(text) / 1024).toFixed(1)} kB).`);
}
