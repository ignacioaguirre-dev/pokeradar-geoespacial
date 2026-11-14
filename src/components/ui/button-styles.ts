// Plain module (no "use client"), so a server component can style a link exactly like a Button

const BASE =
  "relative inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-control px-7 font-sans text-body font-semibold " +
  "transition-colors duration-(--duration-fast) ease-(--curve-out) " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

const VARIANTS = {
  primary: "bg-foreground text-background hover:bg-muted active:bg-muted",
  secondary:
    "border border-control bg-surface text-foreground hover:border-foreground active:border-foreground active:bg-structure",
} as const;

const INACTIVE = "cursor-not-allowed bg-transparent text-muted";

export type ButtonVariant = keyof typeof VARIANTS;

export function buttonClass(variant: ButtonVariant, inactive = false): string {
  return `${BASE} ${inactive ? INACTIVE : VARIANTS[variant]}`;
}
