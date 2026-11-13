type Props = {
  valor: number;
  decimales?: number;
  unidad?: string;
};

export function Cifra({ valor, decimales = 0, unidad }: Props) {
  const texto = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valor);
  return (
    <data value={valor} className="font-mono tabular-nums whitespace-nowrap">
      {unidad ? `${texto} ${unidad}` : texto}
    </data>
  );
}
