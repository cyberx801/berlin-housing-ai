import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.join(root, "src"),
      // `server-only` throws outside the react-server condition; tests import server modules directly.
      "server-only": path.join(root, "tests/support/empty-module.ts"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/support/setup.ts"],
    include: [
      "tests/unit/**/*.test.{ts,tsx}",
      "tests/contracts/**/*.test.ts",
      "tests/component/**/*.test.{ts,tsx}",
    ],
    css: false,
  },
});
