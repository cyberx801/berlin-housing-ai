// Serves MapLibre's web worker from /vendor. MapLibre 6 locates its worker next to its own
// module via import.meta.url, which a bundled chunk can't satisfy, so the map calls
// setWorkerUrl() with this copy (DECISIONS D-038). Runs before `dev` and `build`; the output
// is gitignored. The version in the file name matches maplibre-gl's getVersion().
import { copyFile, mkdir, readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE = path.join(ROOT, "node_modules/maplibre-gl");
const OUT = path.join(ROOT, "public/vendor");

const { version } = JSON.parse(await readFile(path.join(PACKAGE, "package.json"), "utf8"));
// `.js`, not `.mjs`: every static server sends it as JavaScript, which module workers require.
const target = `maplibre-gl-worker-${version}.js`;

await mkdir(OUT, { recursive: true });
for (const name of await readdir(OUT)) {
  if (name.startsWith("maplibre-gl-worker-") && name !== target) await rm(path.join(OUT, name));
}
await copyFile(path.join(PACKAGE, "dist/maplibre-gl-worker.mjs"), path.join(OUT, target));
console.log(`public/vendor/${target}`);
