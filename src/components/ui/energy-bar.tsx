import { useId } from "react";
import { GrowingMeter } from "./growing-meter";
import { Quantity } from "./quantity";

type Props = {
  label: string;
  value: number;
  max: number;
  // The fill grows from zero when the bar appears
  grow?: boolean;
  // Position in a list of growing bars, to stagger them
  order?: number;
};

export function EnergyBar({ label, value, max, grow = false, order }: Props) {
  const id = useId();
  const clamped = Math.min(Math.max(value, 0), Math.max(max, 0));
  return (
    <div className="flex flex-col gap-1 text-foreground">
      <div className="flex items-baseline justify-between gap-2 text-label">
        <label
          htmlFor={id}
          className="font-display font-stretch-condensed font-bold uppercase tracking-wider"
        >
          {label}
        </label>
        <Quantity value={clamped} />
      </div>
      {/* Native meter: role, name and range come from the platform; looks live in globals.css */}
      {grow ? (
        <GrowingMeter id={id} value={clamped} max={max} order={order} />
      ) : (
        <meter id={id} className="energy-meter" min={0} max={max} value={clamped} />
      )}
    </div>
  );
}
