import type { ReactNode } from "react";

type Props = {
  variant: "habitat" | "condition" | "neutral";
  children: ReactNode;
};

// Distinct shapes so meaning does not depend on color alone
const VARIANTS = {
  habitat: { mark: "●", color: "text-habitat" },
  condition: { mark: "◆", color: "text-condition" },
  neutral: { mark: "■", color: "text-muted" },
} as const;

export function Tag({ variant, children }: Props) {
  const { mark, color } = VARIANTS[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-display font-stretch-condensed text-label font-bold uppercase tracking-wider ${color}`}
    >
      <span aria-hidden="true">{mark}</span>
      {children}
    </span>
  );
}
