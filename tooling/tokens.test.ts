import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { relacionDeContraste } from "../src/domain/color/contraste";
import { USO_DE_COLOR } from "../src/domain/color/usos";

const RAIZ = join(__dirname, "..", "src");
const CSS = readFileSync(join(RAIZ, "app", "globals.css"), "utf8");

function colores(): Record<string, string> {
  const bloque = CSS.match(/@theme\s+static\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const mapa: Record<string, string> = {};
  for (const m of bloque.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    mapa[m[1]] = m[2];
  }
  return mapa;
}

const C = colores();

const PARES: ReadonlyArray<{
  primerPlano: string[];
  fondo: string[];
  tipo: "texto" | "grafico";
  minimo: number;
}> = [
  // Every token with a minimum must meet it on both page backgrounds
  ...Object.entries(USO_DE_COLOR).flatMap(([nombre, uso]) =>
    uso.minimo === null
      ? []
      : [{ primerPlano: [nombre], fondo: ["fondo", "superficie"], tipo: uso.tipo as "texto" | "grafico", minimo: uso.minimo }],
  ),
  { primerPlano: ["fondo"], fondo: ["habitat", "texto", "texto-tenue"], tipo: "texto", minimo: 4.5 },
];

describe("relacionDeContraste con la paleta", () => {
  it("coincide con los valores de referencia", () => {
    expect(relacionDeContraste("#0B0E12", "#F1EDE4")).toBeCloseTo(16.55, 1);
    expect(relacionDeContraste("#0B0E12", "#3B3832")).toBeCloseTo(1.66, 1);
  });
});

describe("contraste de los tokens", () => {
  it("cada token tiene un uso declarado", () => {
    expect(Object.keys(USO_DE_COLOR).sort()).toEqual(Object.keys(C).sort());
  });

  it("define todos los colores esperados", () => {
    expect(Object.keys(C).sort()).toEqual(
      [
        "fondo", "superficie", "texto", "texto-tenue", "estructura",
        "borde-control", "habitat", "condicion", "energia", "alerta",
      ].sort(),
    );
  });

  for (const par of PARES) {
    for (const fg of par.primerPlano) {
      for (const bg of par.fondo) {
        it(`${fg} sobre ${bg} cumple ${par.minimo} (${par.tipo})`, () => {
          expect(relacionDeContraste(C[fg], C[bg])).toBeGreaterThanOrEqual(par.minimo);
        });
      }
    }
  }
});

function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return archivos(ruta);
    return /\.(ts|tsx|css)$/.test(e.name) ? [ruta] : [];
  });
}

describe("sin colores sueltos", () => {
  const FUNCIONES = "rgba?|hsla?|lab|lch|oklab|oklch|hwb|color-mix";
  const NOMBRES =
    "red|blue|green|white|black|gray|grey|orange|yellow|purple|pink|cyan|teal|navy|brown|transparent|currentcolor";
  const prohibido = new RegExp(
    [
      String.raw`#[0-9a-fA-F]{3,8}\b`,
      String.raw`\b(?:${FUNCIONES})\(`,
      // Arbitrary color classes such as bg-[red]
      String.raw`-\[(?:${NOMBRES})\]`,
      // Inline style or CSS declarations with a named color
      String.raw`\b(?:color|background(?:-color)?|border(?:-color)?|fill|stroke)\s*:\s*["'\x60]?(?:${NOMBRES})\b`,
    ].join("|"),
    "i",
  );
  const candidatos = archivos(RAIZ).filter(
    (f) => !f.endsWith("globals.css") && !/\.test\.tsx?$/.test(f),
  );

  it("el detector reconoce los casos prohibidos", () => {
    const malos = [
      "#fff", "#A1B2C3", "rgb(1,2,3)", "rgba(0,0,0,.5)", "hsl(0 0% 0%)", "hsla(0,0%,0%,1)",
      "lab(50 0 0)", "lch(50 0 0)", "oklab(1 0 0)", "oklch(0.5 0.1 20)", "hwb(0 0% 0%)",
      "color-mix(in srgb, red, blue)", "bg-[#123456]", "text-[rgb(1,2,3)]", "bg-[red]",
      "text-[oklch(1 0 0)]", 'style={{ color: "red" }}', "background: white",
    ];
    for (const malo of malos) {
      expect(prohibido.test(malo), malo).toBe(true);
    }
    expect(prohibido.test("bg-fondo text-texto border-borde-control")).toBe(false);
  });

  it("ningún archivo de src usa colores fuera de los tokens", () => {
    const infractores = candidatos.filter((f) => prohibido.test(readFileSync(f, "utf8")));
    expect(infractores).toEqual([]);
  });

  it("el tema cierra la paleta por defecto de Tailwind", () => {
    // Without this reset, classes like bg-red-500 or text-white still generate colors
    expect(CSS).toMatch(/@theme\s+static\s*\{\s*--color-\*:\s*initial;/);
  });
});

describe("colores reservados al mapa", () => {
  // Rotulo is the one UI piece that labels habitat and condition by definition
  const PERMITIDOS = ["rotulo.tsx", "rotulo.test.tsx"];
  const UI = join(RAIZ, "components", "ui");
  const utilidad = /\b(?:[a-z-]+:)*(?:bg|text|border(?:-[a-z]{1,2})?|outline|ring|fill|stroke|from|to|via|decoration|shadow|accent|caret|divide)-(?:habitat|condicion)\b/;

  it("el detector reconoce las utilidades prohibidas", () => {
    for (const malo of ["bg-habitat", "text-condicion", "focus-visible:outline-habitat", "border-l-condicion"]) {
      expect(utilidad.test(malo), malo).toBe(true);
    }
    expect(utilidad.test("bg-texto text-fondo")).toBe(false);
  });

  it("ninguna pieza de components/ui usa habitat ni condicion", () => {
    const infractores = archivos(UI).filter(
      (f) => !PERMITIDOS.some((p) => f.endsWith(p)) && utilidad.test(readFileSync(f, "utf8")),
    );
    expect(infractores).toEqual([]);
  });
});
