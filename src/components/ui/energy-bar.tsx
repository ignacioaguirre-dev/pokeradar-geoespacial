import { useId } from "react";
import { Quantity } from "./quantity";

type Props = {
  label: string;
  value: number;
  max: number;
  // The fill grows in on mount; only the drawing moves, the meter holds its value from the start
  grow?: boolean;
};

export function EnergyBar({ label, value, max, grow = false }: Props) {
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
      <meter
        id={id}
        className={grow ? "energy-meter energy-meter-grow" : "energy-meter"}
        min={0}
        max={max}
        value={clamped}
      />
    </div>
  );
}
