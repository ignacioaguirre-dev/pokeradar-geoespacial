import { ESLint } from "eslint";
import { describe, expect, test } from "vitest";

const IMPORTS = "no-restricted-imports";
const SINTAXIS = "no-restricted-syntax";
const GLOBALES = "no-restricted-globals";

const DOMINIO = "src/domain/cerca.ts";
const TEST_DOMINIO = "src/domain/cerca.test.ts";
const TEST_TSX_DOMINIO = "src/domain/cerca.test.tsx";
const FEATURES = "src/features/clima/use-clima.ts";
const MAPA = "src/map/camara.ts";
const UI = "src/components/ui/boton.tsx";
const COMPONENTE = "src/components/detalle/detalle.tsx";
const APP = "src/app/page.tsx";
const LIB = "src/lib/x.ts";

type Prohibido = readonly [nombre: string, archivo: string, codigo: string, regla: string];
type Permitido = readonly [nombre: string, archivo: string, codigo: string];

// One forbidden case per rule block, plus a regression case for every leak found in review.
const prohibidos: Prohibido[] = [
  // One per rule block in eslint.config.mjs
  ["dominio: sólo importa dominio (react)", DOMINIO, `import "react";`, IMPORTS],
  ["dominio: globales de red y DOM (fetch)", DOMINIO, `fetch("/x");`, GLOBALES],
  ["features: no importa mapa", FEATURES, `import "@/map/camara";`, IMPORTS],
  ["mapa: no importa features", MAPA, `import "@/features/cercas/storage";`, IMPORTS],
  ["ui: no importa dominio", UI, `import "@/domain/cerca";`, IMPORTS],
  ["componentes: no importa app", COMPONENTE, `import "@/app/page";`, IMPORTS],
  ["componentes: no importa queries", COMPONENTE, `import "@/features/catalogo/queries";`, IMPORTS],
  ["app: no importa maplibre", APP, `import "maplibre-gl";`, IMPORTS],
  ["carpeta no listada: no importa maplibre", LIB, `import "maplibre-gl";`, IMPORTS],

  // Regression: leaks found during review
  ["subruta de maplibre", COMPONENTE, `import "maplibre-gl/dist/maplibre-gl.css";`, IMPORTS],
  ["carpeta relativa sin archivo", FEATURES, `import "../../map";`, IMPORTS],
  ["maplibre con import() dinámico", COMPONENTE, `await import("maplibre-gl");`, SINTAXIS],
  ["maplibre con import() de plantilla", DOMINIO, "await import(`maplibre-gl`);", SINTAXIS],
  ["maplibre con require", APP, `require("maplibre-gl");`, SINTAXIS],
  ["dominio: alias de carpeta no listada", DOMINIO, `import "@/otra/x";`, IMPORTS],
  ["dominio: paquete corto (fs)", DOMINIO, `import "fs";`, IMPORTS],
  ["dominio: ../ a carpeta no listada", DOMINIO, `import "../otra/x";`, IMPORTS],
  ["dominio: ./../", DOMINIO, `import "./../x";`, IMPORTS],
  ["dominio: @/domain/.. escapa", DOMINIO, `import "@/domain/../app/page";`, IMPORTS],
  ["dominio: ../ desde subcarpeta", "src/domain/geo/borde.ts", `import "../x";`, IMPORTS],
  ["dominio: tests tampoco importan paquetes", TEST_DOMINIO, `import "lodash";`, IMPORTS],
  ["dominio: vitest fuera de tests", DOMINIO, `import { expect } from "vitest";`, IMPORTS],
];

const permitidos: Permitido[] = [
  ["dominio importa dominio", DOMINIO, `import "./x"; import "./sub/x"; import "@/domain/geo/x";`],
  ["dominio: vitest en un test", TEST_DOMINIO, `import { expect } from "vitest";`],
  ["dominio: vitest en un test tsx", TEST_TSX_DOMINIO, `import { expect } from "vitest";`],
  ["features importa dominio y react", FEATURES, `import "@/domain/cerca"; import "react";`],
  ["mapa importa maplibre (estático y dinámico)", MAPA, `import "maplibre-gl"; await import("maplibre-gl");`],
  ["ui importa ui", UI, `import "@/components/ui/otro";`],
  ["componente importa dominio, mapa y storage", COMPONENTE, `import "@/domain/cerca"; import "@/map/camara"; import "@/features/cercas/storage";`],
  ["app importa queries y componentes", APP, `import "@/features/catalogo/queries"; import "@/components/detalle/detalle";`],
  ["carpeta no listada importa react", LIB, `import "react";`],
];

const eslint = new ESLint();

async function mensajes(filePath: string, codigo: string) {
  const [resultado] = await eslint.lintText(codigo, { filePath });
  return resultado.messages;
}

// The first lint call loads the whole Next config, which can exceed the default timeout.
describe("fronteras de carpetas", { timeout: 60_000 }, () => {
  test.each(prohibidos)("prohíbe: %s", async (_nombre, filePath, codigo, regla) => {
    const restringidos = (await mensajes(filePath, codigo)).filter((m) => m.ruleId === regla);
    expect(restringidos.length).toBeGreaterThan(0);
  });

  test.each(permitidos)("permite: %s", async (_nombre, filePath, codigo) => {
    const todos = await mensajes(filePath, codigo);
    expect(todos.filter((m) => m.fatal)).toEqual([]);
    expect(todos.filter((m) => m.ruleId?.startsWith("no-restricted-"))).toEqual([]);
  });
});
