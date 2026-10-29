import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Mirrors the ESLint boundary rules with a plain scan, so a disabled lint rule can't hide a leak.
const ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(ROOT, "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|mts)$/.test(entry) ? [full] : [];
  });
}

const files = sourceFiles(SRC).map((file) => ({
  rel: path.relative(ROOT, file).replaceAll("\\", "/"),
  text: readFileSync(file, "utf8"),
}));

const importsOf = (text: string) => [...text.matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)].map((m) => m[1]!);

describe("data boundaries", () => {
  it("never imports contract test fixtures from src/", () => {
    for (const f of files) {
      for (const spec of importsOf(f.text)) expect(spec, f.rel).not.toMatch(/tests\/contracts|fixtures\/rent/);
    }
  });

  it("imports demo fixtures only from the demo market source", () => {
    for (const f of files) {
      if (f.rel === "src/lib/data/market/demo-source.ts" || f.rel.startsWith("src/lib/fixtures/demo/")) continue;
      for (const spec of importsOf(f.text)) expect(spec, f.rel).not.toMatch(/fixtures\/demo/);
    }
  });

  it("keeps generated geodata behind src/lib/data/geo", () => {
    for (const f of files) {
      if (f.rel.startsWith("src/lib/data/geo/")) continue;
      for (const spec of importsOf(f.text)) expect(spec, f.rel).not.toMatch(/geo\/generated/);
    }
  });

  it("exposes no secret-looking public env vars", () => {
    for (const f of files) {
      expect(f.text, f.rel).not.toMatch(/NEXT_PUBLIC_\w*(KEY|SECRET|TOKEN)/);
    }
  });

  it("has no client component importing server-only data modules", () => {
    for (const f of files) {
      if (!/^["']use client["']/m.test(f.text)) continue;
      for (const spec of importsOf(f.text)) expect(spec, f.rel).not.toMatch(/^@\/lib\/data\//);
    }
  });
});
