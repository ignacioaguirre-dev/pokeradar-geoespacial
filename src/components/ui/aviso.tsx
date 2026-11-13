"use client";

import type { ReactNode } from "react";
import { Boton } from "./boton";

type Props = {
  variante: "informacion" | "exito" | "error";
  titulo: string;
  children?: ReactNode;
  accion?: { etiqueta: string; alActivar: () => void };
};

const VARIANTES = {
  informacion: { marca: "i", borde: "border-borde-control", color: "text-texto" },
  exito: { marca: "✓", borde: "border-texto", color: "text-texto" },
  error: { marca: "!", borde: "border-alerta", color: "text-alerta" },
} as const;

export function Aviso({ variante, titulo, children, accion }: Props) {
  const { marca, borde, color } = VARIANTES[variante];
  return (
    <div
      role={variante === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-panel border bg-superficie p-3 text-texto ${borde}`}
    >
      <span
        aria-hidden="true"
        className={`font-mono text-subtitulo font-bold ${color}`}
      >
        {marca}
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-semibold">{titulo}</p>
        {children ? (
          <div className="text-cuerpo text-texto-tenue">{children}</div>
        ) : null}
      </div>
      {accion ? (
        <Boton variante="secundaria" onClick={accion.alActivar}>
          {accion.etiqueta}
        </Boton>
      ) : null}
    </div>
  );
}
