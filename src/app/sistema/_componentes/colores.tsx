"use client";

import type { ReactNode } from "react";
import { Cifra } from "@/components/ui/cifra";
import {
  contrasteSobreFondo,
  etiquetaDeUso,
  TOKENS,
  usoDe,
  type Contraste,
  type Token,
} from "./tokens";
import { useValorDeToken } from "./use-valor-de-token";

// One list for every width: stacked blocks on phones, aligned columns from lg up
const COLUMNAS =
  "lg:grid lg:grid-cols-[8rem_minmax(0,1fr)_5.5rem_6rem_9.5rem_6.5rem] lg:items-center lg:gap-x-3";

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      {/* Labels only show when stacked; the header row names the columns from lg up */}
      <dt className="w-24 shrink-0 text-etiqueta text-texto-tenue lg:sr-only">{etiqueta}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Resultado({ contraste }: { contraste: Contraste }) {
  if (contraste.tipo === "medido" && contraste.cumple !== null) {
    return contraste.cumple ? "✓ Cumple" : "✕ No cumple";
  }
  return contraste.tipo === "pendiente" ? " " : "Sin mínimo";
}

function Fila({ token }: { token: Token }) {
  const valor = useValorDeToken(token.nombre);
  const fondo = useValorDeToken("fondo");
  const contraste = contrasteSobreFondo(token.nombre, valor, fondo);
  return (
    <li className="flex items-start gap-3 border-t border-estructura py-3 lg:items-center">
      <span
        aria-hidden="true"
        className={`block size-8 shrink-0 rounded-control border border-estructura ${token.muestra}`}
      />
      <dl className={`flex min-w-0 flex-1 flex-col gap-1 text-cuerpo ${COLUMNAS}`}>
        <Campo etiqueta="Token">
          <code className="font-mono">{token.nombre}</code>
        </Campo>
        <Campo etiqueta="Origen">
          <span className="text-texto-tenue">{token.origen}</span>
        </Campo>
        <Campo etiqueta="Valor">
          {/* Fixed width so values appearing after hydration never shift the layout */}
          <code className="inline-block min-w-[8ch] font-mono tabular-nums">
            {contraste.tipo === "pendiente" ? " " : valor}
          </code>
        </Campo>
        <Campo etiqueta="Contraste">
          <span className="inline-block min-w-[9ch] whitespace-nowrap">
            {contraste.tipo === "medido" ? (
              <Cifra valor={contraste.relacion} decimales={2} unidad=": 1" />
            ) : contraste.tipo === "base" ? (
              "—"
            ) : (
              " "
            )}
          </span>
        </Campo>
        <Campo etiqueta="Uso">{etiquetaDeUso(usoDe(token.nombre))}</Campo>
        <Campo etiqueta="Resultado">
          <span className="inline-block min-w-[9ch] whitespace-nowrap">
            <Resultado contraste={contraste} />
          </span>
        </Campo>
      </dl>
    </li>
  );
}

export function Colores() {
  return (
    <div className="flex flex-col">
      <p className="text-etiqueta text-texto-tenue">
        Contraste de cada color sobre el fondo, contra el mínimo de su uso.
      </p>
      {/* Visual column names; the rows already carry them for assistive tech */}
      <div
        aria-hidden="true"
        className={`hidden pl-11 pt-4 pb-2 text-etiqueta text-texto-tenue ${COLUMNAS}`}
      >
        <span>Token</span>
        <span>Origen</span>
        <span>Valor</span>
        <span>Contraste</span>
        <span>Uso</span>
        <span>Resultado</span>
      </div>
      <ul className="mt-3 lg:mt-0">
        {TOKENS.map((t) => (
          <Fila key={t.nombre} token={t} />
        ))}
      </ul>
    </div>
  );
}
