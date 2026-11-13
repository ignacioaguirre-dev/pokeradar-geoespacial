export type UsoDeColor = {
  tipo: "base" | "texto" | "grafico" | "decorativo";
  // WCAG minimum against the page backgrounds; null when none applies
  minimo: number | null;
};

// Single source for what each color token is allowed to be used for
export const USO_DE_COLOR = {
  fondo: { tipo: "base", minimo: null },
  superficie: { tipo: "decorativo", minimo: null },
  texto: { tipo: "texto", minimo: 4.5 },
  "texto-tenue": { tipo: "texto", minimo: 4.5 },
  estructura: { tipo: "decorativo", minimo: null },
  "borde-control": { tipo: "grafico", minimo: 3 },
  habitat: { tipo: "texto", minimo: 4.5 },
  condicion: { tipo: "texto", minimo: 4.5 },
  energia: { tipo: "grafico", minimo: 3 },
  alerta: { tipo: "texto", minimo: 4.5 },
} as const satisfies Record<string, UsoDeColor>;

// null when the use has no minimum to meet
export function cumpleUso(relacion: number, uso: UsoDeColor): boolean | null {
  return uso.minimo === null ? null : relacion >= uso.minimo;
}
