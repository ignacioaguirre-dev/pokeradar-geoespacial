import { useId } from "react";
import { Cifra } from "./cifra";

type Props = {
  nombre: string;
  valor: number;
  maximo: number;
};

export function BarraEnergia({ nombre, valor, maximo }: Props) {
  const id = useId();
  const acotado = Math.min(Math.max(valor, 0), Math.max(maximo, 0));
  return (
    <div className="flex flex-col gap-1 text-texto">
      <div className="flex items-baseline justify-between gap-2 text-etiqueta">
        <label
          htmlFor={id}
          className="font-display font-stretch-condensed font-bold uppercase tracking-wider"
        >
          {nombre}
        </label>
        <Cifra valor={acotado} />
      </div>
      {/* Native meter: role, name and range come from the platform; looks live in globals.css */}
      <meter id={id} className="medidor-energia" min={0} max={maximo} value={acotado} />
    </div>
  );
}
