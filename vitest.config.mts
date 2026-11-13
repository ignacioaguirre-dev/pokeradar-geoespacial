import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
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
