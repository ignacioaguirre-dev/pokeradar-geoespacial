import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Avisos } from "./_componentes/avisos";
import { Colores } from "./_componentes/colores";
import { BarraEnergia } from "@/components/ui/barra-energia";
import { Boton } from "@/components/ui/boton";
import { Cifra } from "@/components/ui/cifra";
import { Rotulo } from "@/components/ui/rotulo";
import { DURACIONES, ESCALA } from "./_componentes/tokens";

export const metadata: Metadata = {
  title: "Sistema · PokeRadar Geoespacial",
  robots: { index: false, follow: false },
};

function Seccion({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 border-t border-estructura pt-6">
      <h2
        id={id}
        className="font-display font-stretch-condensed text-titulo font-bold uppercase tracking-tight"
      >
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function Sub({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-etiqueta text-texto-tenue">{titulo}</h3>
      <div className="flex flex-wrap items-center gap-4">{children}</div>
    </div>
  );
}

export default function Sistema() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10">
      <header className="flex flex-col gap-2">
        <h1 className="font-display font-stretch-condensed text-cabecera font-bold uppercase tracking-tight">
          Sistema de diseño
        </h1>
        <p className="text-texto-tenue">
          Referencia viva de los tokens y las primitivas de PokeRadar Geoespacial.
        </p>
      </header>

      <Seccion id="sistema-colores" titulo="Colores">
        <Colores />
      </Seccion>

      <Seccion id="sistema-tipografia" titulo="Tipografía">
        <dl className="flex flex-col gap-3">
          {ESCALA.map((e) => (
            <div key={e.nombre} className="flex flex-col gap-1">
              <dt className="text-etiqueta text-texto-tenue">
                <code className="font-mono">{e.nombre}</code> · {e.tamano} · {e.fuente}
              </dt>
              <dd className={e.clase}>Pikachu en el Aconcagua</dd>
            </div>
          ))}
        </dl>
        <p className="text-cuerpo">
          Las cifras van en Chivo Mono, con dígitos de ancho fijo:{" "}
          <Cifra valor={1234567.89} decimales={2} />
        </p>
      </Seccion>

      <Seccion id="sistema-movimiento" titulo="Movimiento">
        <dl className="flex flex-col gap-2">
          {DURACIONES.map((d) => (
            <div key={d.nombre} className="flex gap-4">
              <dt className="w-48 text-etiqueta text-texto-tenue">
                <code className="font-mono">{d.nombre}</code>
              </dt>
              <dd>
                <Cifra valor={d.ms} unidad="ms" />
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-texto-tenue">
          Con movimiento reducido todas las duraciones pasan a 0 ms.
        </p>
      </Seccion>

      <Seccion id="sistema-boton" titulo="Botón">
        <Sub titulo="Principal">
          <Boton>Guardar</Boton>
          <Boton motivoDeshabilitado="Faltan 2 vértices">Crear cerca</Boton>
          <Boton cargando>Buscando</Boton>
        </Sub>
        <Sub titulo="Secundaria">
          <Boton variante="secundaria">Cancelar</Boton>
          <Boton variante="secundaria" motivoDeshabilitado="Elegí una zona primero">
            Exportar
          </Boton>
          <Boton variante="secundaria" cargando>
            Cargando
          </Boton>
        </Sub>
      </Seccion>

      <Seccion id="sistema-rotulo" titulo="Rótulo">
        <div className="flex flex-wrap gap-6">
          <Rotulo variante="habitat">Bosque</Rotulo>
          <Rotulo variante="condicion">Lluvia</Rotulo>
          <Rotulo variante="neutro">Sin dato</Rotulo>
        </div>
      </Seccion>

      <Seccion id="sistema-barra-de-energia" titulo="Barra de energía">
        <div className="flex max-w-sm flex-col gap-4">
          <BarraEnergia nombre="Bajo" valor={25} maximo={255} />
          <BarraEnergia nombre="Medio" valor={128} maximo={255} />
          <BarraEnergia nombre="Máximo" valor={255} maximo={255} />
        </div>
      </Seccion>

      <Seccion id="sistema-cifra" titulo="Cifra">
        <div className="flex flex-wrap gap-6 text-subtitulo">
          <Cifra valor={84} />
          <Cifra valor={1234.5} decimales={1} />
          <Cifra valor={1234.5} decimales={1} unidad="km²" />
        </div>
      </Seccion>

      <Seccion id="sistema-aviso" titulo="Aviso">
        <Avisos />
      </Seccion>
    </main>
  );
}
