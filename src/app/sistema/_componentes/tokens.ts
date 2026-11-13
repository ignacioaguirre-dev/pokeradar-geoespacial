import { relacionDeContraste } from "@/domain/color/contraste";
import { cumpleUso, USO_DE_COLOR, type UsoDeColor } from "@/domain/color/usos";

export type Token = { nombre: string; muestra: string; origen: string };

// Full class names so Tailwind can see them statically
export const TOKENS: readonly Token[] = [
  { nombre: "fondo", muestra: "bg-fondo", origen: "Noche de la puna" },
  { nombre: "superficie", muestra: "bg-superficie", origen: "Derivado de: Noche de la puna" },
  { nombre: "texto", muestra: "bg-texto", origen: "Sal de Salinas Grandes" },
  { nombre: "texto-tenue", muestra: "bg-texto-tenue", origen: "Derivado de: Sal de Salinas Grandes" },
  { nombre: "estructura", muestra: "bg-estructura", origen: "Basalto de la meseta" },
  { nombre: "borde-control", muestra: "bg-borde-control", origen: "Derivado de: Basalto de la meseta" },
  { nombre: "habitat", muestra: "bg-habitat", origen: "Ocre de la puna jujeña" },
  { nombre: "condicion", muestra: "bg-condicion", origen: "Hielo del Perito Moreno" },
  { nombre: "energia", muestra: "bg-energia", origen: "Flor de ceibo" },
  { nombre: "alerta", muestra: "bg-alerta", origen: "Piedra de Talampaya" },
];

const DISPLAY = "font-display font-stretch-condensed font-bold uppercase";

// Each step is shown with the family it is really used in
export const ESCALA = [
  { nombre: "etiqueta", clase: `text-etiqueta ${DISPLAY}`, tamano: "0,75 rem", fuente: "Archivo condensada" },
  { nombre: "cuerpo", clase: "text-cuerpo font-sans", tamano: "0,9375 rem", fuente: "Chivo" },
  { nombre: "subtitulo", clase: "text-subtitulo font-sans", tamano: "1,125 rem", fuente: "Chivo" },
  { nombre: "titulo", clase: `text-titulo ${DISPLAY}`, tamano: "1,5 a 1,875 rem", fuente: "Archivo condensada" },
  { nombre: "cabecera", clase: `text-cabecera ${DISPLAY}`, tamano: "2,25 a 3,25 rem", fuente: "Archivo condensada" },
  { nombre: "portada", clase: `text-portada ${DISPLAY}`, tamano: "3,5 a 5,5 rem", fuente: "Archivo condensada" },
] as const;

export const DURACIONES = [
  { nombre: "rapida", ms: 120 },
  { nombre: "media", ms: 240 },
  { nombre: "barrido", ms: 900 },
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

export type Contraste =
  | { tipo: "pendiente" }
  | { tipo: "base" }
  | { tipo: "medido"; relacion: number; cumple: boolean | null };

export function usoDe(nombre: string): UsoDeColor {
  return USO_DE_COLOR[nombre as keyof typeof USO_DE_COLOR];
}

export function etiquetaDeUso(uso: UsoDeColor): string {
  const minimo = uso.minimo === null ? "" : ` · mín. ${String(uso.minimo).replace(".", ",")}`;
  const nombre = { base: "Fondo base", texto: "Texto", grafico: "Gráfico", decorativo: "Decorativo" }[uso.tipo];
  return nombre + minimo;
}

// Values are empty until hydration; the base color has no contrast against itself
export function contrasteSobreFondo(nombre: string, valor: string, fondo: string): Contraste {
  if (!HEX.test(valor) || !HEX.test(fondo)) return { tipo: "pendiente" };
  if (nombre === "fondo") return { tipo: "base" };
  const relacion = relacionDeContraste(valor, fondo);
  return { tipo: "medido", relacion, cumple: cumpleUso(relacion, usoDe(nombre)) };
}
