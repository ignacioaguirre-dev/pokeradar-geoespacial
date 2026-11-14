"use client";

import type { ReactNode } from "react";
import { Button } from "./button";

type Props = {
  variant: "info" | "success" | "error";
  title: string;
  children?: ReactNode;
  action?: { label: string; onActivate: () => void };
  // False inside a live region that already exists: a role on a node inserted later may go unannounced
  live?: boolean;
};

const VARIANTS = {
  info: { mark: "i", border: "border-control", color: "text-foreground" },
  success: { mark: "✓", border: "border-foreground", color: "text-foreground" },
  error: { mark: "!", border: "border-alert", color: "text-alert" },
} as const;

export function Notice({ variant, title, children, action, live = true }: Props) {
  const { mark, border, color } = VARIANTS[variant];
  return (
    <div
      role={live ? (variant === "error" ? "alert" : "status") : undefined}
      className={`flex items-start gap-3 rounded-panel border bg-surface p-3 text-foreground ${border}`}
    >
      <span aria-hidden="true" className={`font-mono text-subtitle font-bold ${color}`}>
        {mark}
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {children ? <div className="text-body text-muted">{children}</div> : null}
      </div>
      {action ? (
        <Button variant="secondary" onClick={action.onActivate}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
