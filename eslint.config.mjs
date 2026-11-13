import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Matches a folder through the "@/" alias and relative paths, with or without a file inside it.
const folder = (name) => [`@/${name}`, `**/${name}`, `**/${name}/**`];

const forbid = (options) => ({
  "no-restricted-imports": [
    "error",
    {
      paths: options.paths ?? [],
      patterns: (options.patterns ?? []).map(([group, message]) => ({ group, message })),
    },
  ],
});

const maplibre = {
  name: "maplibre-gl",
  message: "maplibre-gl is only imported from src/map.",
};
const maplibreSubpath = [["maplibre-gl/**"], "maplibre-gl is only imported from src/map."];
const queries = [
  [["**/queries", "**/queries/**"], "Queries are server-only: read them from src/app, not from this folder."],
];

// src/domain imports only from src/domain, plus vitest in tests.
// The regex rejects every package, other alias and ".." path; the folder patterns only give clearer messages.
// Allowed: "./..." and "@/domain/..." with no ".." segment anywhere. Parent-relative imports go through "@/domain/...".
const allowedDomain = String.raw`(?!(?:.*/)?\.\.(?:/|$))(?:\./|@/domain(?:/|$))`;
const domain = (withVitest) => ({
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          regex: withVitest
            ? String.raw`^(?!${allowedDomain}|vitest$)`
            : String.raw`^(?!${allowedDomain})`,
          message: "src/domain is pure logic: it only imports from src/domain (and vitest in tests).",
        },
        ...["features", "map", "components", "app", "data", "lib", "hooks"].map((name) => ({
          group: folder(name),
          message: `src/domain is pure logic: it does not import src/${name}.`,
        })),
        { group: ["**/queries", "**/queries/**"], message: "src/domain is pure logic: it does not import queries." },
      ],
    },
  ],
});

const browserGlobals = {
  "no-restricted-globals": [
    "error",
    ...[
      "fetch",
      "window",
      "document",
      "localStorage",
      "sessionStorage",
      "navigator",
      "XMLHttpRequest",
    ].map((name) => ({ name, message: "src/domain is pure logic: no network or DOM." })),
  ],
};

// Dynamic import() and require() are invisible to no-restricted-imports.
const dynamicMaplibre = {
  "no-restricted-syntax": [
    "error",
    {
      selector: "ImportExpression[source.type='Literal'][source.value=/^maplibre-gl/]",
      message: "maplibre-gl is only imported from src/map.",
    },
    {
      selector: "ImportExpression[source.type='TemplateLiteral'][source.quasis.0.value.raw=/^maplibre-gl/]",
      message: "maplibre-gl is only imported from src/map.",
    },
    {
      selector: "CallExpression[callee.name='require'][arguments.0.value=/^maplibre-gl/]",
      message: "maplibre-gl is only imported from src/map.",
    },
  ],
};

// Each block replaces the rule for its files, so a file must match exactly one block.
const boundaries = [
  {
    files: ["src/domain/**"],
    ignores: ["src/domain/**/*.test.{ts,tsx}"],
    rules: { ...domain(false), ...browserGlobals },
  },
  {
    files: ["src/domain/**/*.test.{ts,tsx}"],
    rules: { ...domain(true), ...browserGlobals },
  },
  {
    files: ["src/features/**"],
    rules: forbid({
      paths: [maplibre],
      patterns: [
        maplibreSubpath,
        [folder("map"), "src/features must not import src/map."],
        [folder("components"), "src/features must not import components."],
        [folder("app"), "src/features must not import src/app."],
      ],
    }),
  },
  {
    files: ["src/hooks/**"],
    rules: forbid({
      paths: [maplibre],
      patterns: [
        maplibreSubpath,
        [folder("domain"), "src/hooks is generic and business-free: it must not import domain."],
        [folder("features"), "src/hooks is generic and business-free: it must not import features."],
        [folder("map"), "src/hooks is generic and business-free: it must not import src/map."],
        [folder("components"), "src/hooks is generic and business-free: it must not import components."],
        [folder("app"), "src/hooks is generic and business-free: it must not import src/app."],
        [folder("data"), "src/hooks is generic and business-free: it must not import data."],
        [folder("lib"), "src/hooks is generic and business-free: it must not import src/lib."],
        ...queries,
      ],
    }),
  },
  {
    files: ["src/map/**"],
    rules: forbid({
      patterns: [
        [folder("features"), "src/map must not import features: it receives data through props."],
        [folder("components"), "src/map must not import components."],
        [folder("app"), "src/map must not import src/app."],
        ...queries,
      ],
    }),
  },
  {
    files: ["src/components/ui/**"],
    rules: forbid({
      paths: [maplibre],
      patterns: [
        maplibreSubpath,
        [folder("domain"), "src/components/ui is pure presentation: it must not import domain."],
        [folder("features"), "src/components/ui is pure presentation: it must not import features."],
        [folder("map"), "src/components/ui is pure presentation: it must not import src/map."],
        [folder("app"), "src/components/ui must not import src/app."],
        ...queries,
      ],
    }),
  },
  {
    files: ["src/components/**"],
    ignores: ["src/components/ui/**"],
    rules: forbid({
      paths: [maplibre],
      patterns: [
        maplibreSubpath,
        [folder("app"), "src/components must not import src/app."],
        ...queries,
      ],
    }),
  },
  {
    files: ["src/app/**"],
    rules: forbid({ paths: [maplibre], patterns: [maplibreSubpath] }),
  },
  // Any other folder (lib, data, src root, ...) gets the maplibre ban for static imports.
  {
    files: ["src/**"],
    ignores: [
      "src/domain/**",
      "src/features/**",
      "src/hooks/**",
      "src/map/**",
      "src/components/**",
      "src/app/**",
    ],
    rules: forbid({ paths: [maplibre], patterns: [maplibreSubpath] }),
  },
  { files: ["src/**"], ignores: ["src/map/**"], rules: dynamicMaplibre },
];

// Test utilities are for tests only: overlay every folder block with the ban, except tests and src/testing.
// The overlay comes later, so test files keep the original block and non-test files get the extra pattern.
const noTesting = {
  group: folder("testing"),
  message: "src/testing is only imported from tests.",
};
const testingOverlay = boundaries
  .filter((b) => b.rules["no-restricted-imports"] && !b.files.includes("src/domain/**"))
  .map((b) => {
    const [level, opts] = b.rules["no-restricted-imports"];
    return {
      files: b.files,
      ignores: [...(b.ignores ?? []), "src/**/*.test.{ts,tsx}", "src/testing/**"],
      rules: {
        ...b.rules,
        "no-restricted-imports": [level, { ...opts, patterns: [...opts.patterns, noTesting] }],
      },
    };
  });

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...boundaries,
  ...testingOverlay,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Tool output
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
