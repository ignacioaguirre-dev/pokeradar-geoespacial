"use client";

import { useId, type ButtonHTMLAttributes } from "react";

type Props = {
  variante?: "principal" | "secundaria";
  cargando?: boolean;
  motivoDeshabilitado?: string;
  etiquetaCargando?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const BASE =
  "relative inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-control px-7 font-sans text-cuerpo font-semibold " +
  "transition-colors duration-(--duracion-rapida) ease-(--curva-salida) " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-texto";

const VARIANTES = {
  principal:
    "bg-texto text-fondo hover:bg-texto-tenue active:bg-texto-tenue",
  secundaria:
    "border border-borde-control bg-superficie text-texto hover:border-texto active:border-texto active:bg-estructura",
} as const;

const INACTIVO =
  "cursor-not-allowed bg-transparent text-texto-tenue";

export function Boton({
  variante = "principal",
  cargando = false,
  motivoDeshabilitado,
  etiquetaCargando = "Cargando…",
  disabled,
  onClick,
  className = "",
  children,
  type = "button",
  ...resto
}: Props) {
  const idMotivo = useId();
  const conMotivo = Boolean(motivoDeshabilitado);
  const inactivo = conMotivo || Boolean(disabled);
  const describedBy =
    [resto["aria-describedby"], conMotivo ? idMotivo : undefined]
      .filter(Boolean)
      .join(" ") || undefined;
  const bloqueado = inactivo || cargando;

  const boton = (
    <button
      {...resto}
      type={type}
      // Stays focusable with a reason so keyboard users can discover it
      disabled={disabled}
      aria-disabled={conMotivo || cargando ? true : undefined}
      aria-busy={cargando ? true : undefined}
      aria-describedby={describedBy}
      onClick={(e) => {
        if (bloqueado) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={`${BASE} ${inactivo ? INACTIVO : VARIANTES[variante]} ${className}`}
    >
      {/* The spinner sits in the left padding so the label stays visible and the width does not change */}
      {cargando ? (
        <span
          aria-hidden="true"
          className="absolute left-2 size-4 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
        />
      ) : null}
      <span>{children}</span>
    </button>
  );

  // Same tree shape in every state so the button is never remounted (focus is kept)
  return (
    <span className="inline-flex items-center gap-3">
      {boton}
      {/* Persistent region: only text changes get announced */}
      <span className="sr-only" aria-live="polite">
        {cargando ? etiquetaCargando : ""}
      </span>
      {conMotivo ? (
        <span id={idMotivo} className="text-etiqueta text-texto-tenue">
          {motivoDeshabilitado}
        </span>
      ) : null}
    </span>
  );
}
