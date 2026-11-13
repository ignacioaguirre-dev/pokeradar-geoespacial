type Props = {
  value: number;
  decimals?: number;
  unit?: string;
};

export function Quantity({ value, decimals = 0, unit }: Props) {
  const text = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return (
    <data value={value} className="font-mono tabular-nums whitespace-nowrap">
      {unit ? `${text} ${unit}` : text}
    </data>
  );
}
