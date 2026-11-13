import type { ReactNode } from "react";

type Props = {
  variante: "habitat" | "condicion" | "neutro";
  children: ReactNode;
};

// Distinct shapes so meaning does not depend on color alone
const VARIANTES = {
  habitat: { marca: "●", color: "text-habitat" },
  condicion: { marca: "◆", color: "text-condicion" },
  neutro: { marca: "■", color: "text-texto-tenue" },
} as const;

export function Rotulo({ variante, children }: Props) {
  const { marca, color } = VARIANTES[variante];
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-display font-stretch-condensed text-etiqueta font-bold uppercase tracking-wider ${color}`}
    >
      <span aria-hidden="true">{marca}</span>
      {children}
    </span>
  );
}
