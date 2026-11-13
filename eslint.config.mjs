import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Matches a folder through the "@/" alias and relative paths, with or without a file inside it.
const carpeta = (nombre) => [`@/${nombre}`, `**/${nombre}`, `**/${nombre}/**`];

const prohibir = (mensajes) => ({
  "no-restricted-imports": [
    "error",
    {
      paths: mensajes.paths ?? [],
      patterns: (mensajes.patrones ?? []).map(([group, message]) => ({ group, message })),
    },
  ],
});

const maplibre = {
  name: "maplibre-gl",
  message: "maplibre-gl sólo se importa desde src/map.",
};
const maplibreSub = [["maplibre-gl/**"], "maplibre-gl sólo se importa desde src/map."];
const queries = [
  [["**/queries", "**/queries/**"], "Las queries son del servidor: se leen desde src/app, no desde esta carpeta."],
];

// src/domain imports only from src/domain, plus vitest in tests.
// The regex rejects every package, other alias and ".." path; the folder patterns only give clearer messages.
// Allowed: "./..." and "@/domain/..." with no ".." segment anywhere. Parent-relative imports go through "@/domain/...".
const dominioPermitido = String.raw`(?!(?:.*/)?\.\.(?:/|$))(?:\./|@/domain(?:/|$))`;
const dominio = (conVitest) => ({
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          regex: conVitest
            ? String.raw`^(?!${dominioPermitido}|vitest$)`
            : String.raw`^(?!${dominioPermitido})`,
          message: "src/domain es lógica pura: sólo importa desde src/domain (y vitest en los tests).",
        },
        ...["features", "map", "components", "app", "data", "lib"].map((nombre) => ({
          group: carpeta(nombre),
          message: `src/domain es lógica pura: no importa src/${nombre}.`,
        })),
        { group: ["**/queries", "**/queries/**"], message: "src/domain es lógica pura: no importa queries." },
      ],
    },
  ],
});

const globalesDelNavegador = {
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
    ].map((name) => ({ name, message: "src/domain es lógica pura: sin red ni DOM." })),
  ],
};

// Dynamic import() and require() are invisible to no-restricted-imports.
const maplibreDinamico = {
  "no-restricted-syntax": [
    "error",
    {
      selector: "ImportExpression[source.type='Literal'][source.value=/^maplibre-gl/]",
      message: "maplibre-gl sólo se importa desde src/map.",
    },
    {
      selector: "ImportExpression[source.type='TemplateLiteral'][source.quasis.0.value.raw=/^maplibre-gl/]",
      message: "maplibre-gl sólo se importa desde src/map.",
    },
    {
      selector: "CallExpression[callee.name='require'][arguments.0.value=/^maplibre-gl/]",
      message: "maplibre-gl sólo se importa desde src/map.",
    },
  ],
};

// Each block replaces the rule for its files, so a file must match exactly one block.
const fronteras = [
  {
    files: ["src/domain/**"],
    ignores: ["src/domain/**/*.test.{ts,tsx}"],
    rules: { ...dominio(false), ...globalesDelNavegador },
  },
  {
    files: ["src/domain/**/*.test.{ts,tsx}"],
    rules: { ...dominio(true), ...globalesDelNavegador },
  },
  {
    files: ["src/features/**"],
    rules: prohibir({
      paths: [maplibre],
      patrones: [
        maplibreSub,
        [carpeta("map"), "src/features no importa src/map."],
        [carpeta("components"), "src/features no importa componentes."],
        [carpeta("app"), "src/features no importa src/app."],
      ],
    }),
  },
  {
    files: ["src/map/**"],
    rules: prohibir({
      patrones: [
        [carpeta("features"), "src/map no importa features: recibe datos por props."],
        [carpeta("components"), "src/map no importa componentes."],
        [carpeta("app"), "src/map no importa src/app."],
        ...queries,
      ],
    }),
  },
  {
    files: ["src/components/ui/**"],
    rules: prohibir({
      paths: [maplibre],
      patrones: [
        maplibreSub,
        [carpeta("domain"), "src/components/ui es presentación pura: no importa dominio."],
        [carpeta("features"), "src/components/ui es presentación pura: no importa features."],
        [carpeta("map"), "src/components/ui es presentación pura: no importa src/map."],
        [carpeta("app"), "src/components/ui no importa src/app."],
        ...queries,
      ],
    }),
  },
  {
    files: ["src/components/**"],
    ignores: ["src/components/ui/**"],
    rules: prohibir({
      paths: [maplibre],
      patrones: [
        maplibreSub,
        [carpeta("app"), "src/components no importa src/app."],
        ...queries,
      ],
    }),
  },
  {
    files: ["src/app/**"],
    rules: prohibir({ paths: [maplibre], patrones: [maplibreSub] }),
  },
  // Any other folder (lib, data, src root, ...) gets the maplibre ban for static imports.
  {
    files: ["src/**"],
    ignores: ["src/domain/**", "src/features/**", "src/map/**", "src/components/**", "src/app/**"],
    rules: prohibir({ paths: [maplibre], patrones: [maplibreSub] }),
  },
  { files: ["src/**"], ignores: ["src/map/**"], rules: maplibreDinamico },
];

// Test utilities are for tests only: overlay every folder block with the ban, except tests and src/testing.
// The overlay comes later, so test files keep the original block and non-test files get the extra pattern.
const sinTesting = {
  group: carpeta("testing"),
  message: "src/testing sólo se importa desde tests.",
};
const soloTests = fronteras
  .filter((b) => b.rules["no-restricted-imports"] && !b.files.includes("src/domain/**"))
  .map((b) => {
    const [nivel, opciones] = b.rules["no-restricted-imports"];
    return {
      files: b.files,
      ignores: [...(b.ignores ?? []), "src/**/*.test.{ts,tsx}", "src/testing/**"],
      rules: {
        ...b.rules,
        "no-restricted-imports": [nivel, { ...opciones, patterns: [...opciones.patterns, sinTesting] }],
      },
    };
  });

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...fronteras,
  ...soloTests,
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
