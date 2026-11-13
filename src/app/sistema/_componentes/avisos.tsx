"use client";

import { useState } from "react";
import { Aviso } from "@/components/ui/aviso";

export function Avisos() {
  const [intentos, setIntentos] = useState(0);
  return (
    <div className="flex flex-col gap-3">
      <Aviso variante="informacion" titulo="Radar actualizado">
        Se cargaron los avistamientos de las últimas 24 horas.
      </Aviso>
      <Aviso variante="exito" titulo="Cerca guardada" />
      <Aviso
        variante="error"
        titulo="No se pudo cargar el mapa"
        accion={{ etiqueta: "Reintentar", alActivar: () => setIntentos((n) => n + 1) }}
      >
        Revisá tu conexión. Intentos: {intentos}
      </Aviso>
    </div>
  );
}
