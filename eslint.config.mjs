import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Import boundaries — docs/architecture/FRONTEND_ARCHITECTURE.md §2, DATA_BOUNDARIES.md §5.
// ESLint replaces (does not merge) rule options across config objects, so each scope
// lists the full pattern set it needs.
const DEMO_FIXTURES = {
  group: ["@/lib/fixtures/*", "@/lib/fixtures/**", "**/lib/fixtures/**"],
  message:
    "Demo fixtures may only be imported by src/lib/data/market/demo-source.ts (DATA_BOUNDARIES §5).",
};
const TEST_FIXTURES = {
  group: ["**/tests/**"],
  message: "src/ must never import test or contract fixtures.",
};
const GEO_GENERATED = {
  group: ["@/lib/data/geo/generated/*", "**/data/geo/generated/*"],
  message: "Generated geodata is read only through src/lib/data/geo (server-only accessors).",
};
const UPWARD_FROM_COMPONENTS = {
  group: ["@/features/*", "@/features/**", "@/app/*", "@/app/**", "@/lib/data/*", "@/lib/data/**"],
  message: "components/ are presentational: no imports from features/, app/ or data access.",
};
const UPWARD_FROM_LIB = {
  group: ["@/features/*", "@/features/**", "@/app/*", "@/app/**", "@/components/*", "@/components/**"],
  message: "lib/ must not depend on app/, features/ or components/.",
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [DEMO_FIXTURES, TEST_FIXTURES, GEO_GENERATED] }],
      "no-restricted-syntax": [
        "error",
        {
          selector: "MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^NEXT_PUBLIC_.*(KEY|SECRET|TOKEN)/]",
          message: "Secrets must never use NEXT_PUBLIC_ variables (PREDICTION_API.md §7).",
        },
      ],
    },
  },
  {
    files: ["src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [DEMO_FIXTURES, TEST_FIXTURES, GEO_GENERATED, UPWARD_FROM_COMPONENTS] },
      ],
    },
  },
  {
    files: ["src/lib/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [DEMO_FIXTURES, TEST_FIXTURES, GEO_GENERATED, UPWARD_FROM_LIB] },
      ],
    },
  },
  {
    // The single sanctioned importer of each boundary.
    files: ["src/lib/data/market/demo-source.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [TEST_FIXTURES, GEO_GENERATED, UPWARD_FROM_LIB] }],
    },
  },
  {
    files: ["src/lib/data/geo/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [DEMO_FIXTURES, TEST_FIXTURES, UPWARD_FROM_LIB] }],
    },
  },
  globalIgnores([
    ".next/**",
    ".next-live/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "public/geo/**",
    // Third-party build output copied from node_modules (scripts/copy-maplibre-worker.mjs).
    "public/vendor/**",
  ]),
]);

export default eslintConfig;
