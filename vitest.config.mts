import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";

// Mirrors the Turbopack rule in next.config.ts: .geojson files load as JSON
const geojson: Plugin = {
  name: "geojson",
  transform(code, id) {
    if (id.endsWith(".geojson")) return { code: `export default ${code};`, map: null };
  },
};

export default defineConfig({
  plugins: [react(), geojson],
  resolve: {
    tsconfigPaths: true,
    // Next aliases next/dynamic to its App Router build; the default one wraps refs and swallows them
    alias: [{ find: /^next\/dynamic$/, replacement: "next/dist/api/app-dynamic" }],
  },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/domain/**"],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "logica",
          include: ["src/**/*.test.ts", "tooling/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "componentes",
          include: ["src/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
